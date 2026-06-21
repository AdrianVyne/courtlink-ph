import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import { z } from "zod";
import { type AuthenticatedRequest, Public, getSessionUser } from "../auth/session.guard.js";
// biome-ignore lint/style/useImportType: CoachBookingService is injected at runtime.
import { CoachBookingService } from "./coach-booking.service.js";
// biome-ignore lint/style/useImportType: CoachMarketService is injected at runtime.
import { CoachMarketService } from "./coach-market.service.js";
// biome-ignore lint/style/useImportType: CoachService is injected at runtime.
import { CoachService } from "./coach.service.js";
// biome-ignore lint/style/useImportType: NotificationDispatcher is injected at runtime.
import { NotificationDispatcher } from "../notifications/notification.dispatcher.js";

const channelEnum = z.enum(["GCASH", "MAYA", "QR_PH", "BANK_TRANSFER", "OTHER"]);

const profileSchema = z.object({
  bio: z.string().max(2000).optional().nullable(),
  experience: z.string().max(2000).optional().nullable(),
  hourlyRate: z.number().positive().max(1_000_000),
});

const availabilitySchema = z.object({
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  location: z.string().min(2).max(200),
});

const requestSchema = z.object({
  targetCoachId: z.string().uuid().optional().nullable(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  location: z.string().min(2).max(200),
  groupSize: z.number().int().min(1).max(64),
  skillLevel: z.string().min(1).max(40),
  goals: z.string().max(2000).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

const offerSchema = z.object({
  requestId: z.string().uuid(),
  amount: z.number().positive().max(1_000_000),
  message: z.string().max(1000).optional().nullable(),
  expiresAt: z.string().datetime(),
});

const acceptSchema = z.object({ offerId: z.string().uuid() });

const proofSchema = z.object({
  bookingId: z.string().uuid(),
  channel: channelEnum,
  transactionRef: z.string().min(2).max(120),
  proofObjectKey: z.string().min(2).max(255),
});

const reviewSchema = z.object({
  submissionId: z.string().uuid(),
  bookingId: z.string().uuid(),
  reason: z.string().max(500).optional().nullable(),
});

@Controller({ path: "coaches", version: "1" })
export class CoachController {
  constructor(
    private readonly coaches: CoachService,
    private readonly market: CoachMarketService,
    private readonly bookings: CoachBookingService,
    private readonly notifier: NotificationDispatcher,
  ) {}

  @Public()
  @Get()
  async listPublic(@Query("verifiedOnly") verifiedOnly?: string) {
    return this.coaches.listPublicProfiles({ verifiedOnly: verifiedOnly === "true" });
  }

  @Public()
  @Get(":id")
  async detail(@Param("id") id: string) {
    const profile = await this.coaches.findProfileById(id);
    if (!profile) throw new BadRequestException({ code: "COACH_NOT_FOUND" });
    const availability = await this.coaches.listAvailability(id);
    return { profile, availability };
  }

  @Post("profile")
  @HttpCode(200)
  async upsertProfile(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const user = getSessionUser(request);
    const input = profileSchema.parse(body);
    return this.coaches.upsertProfile({ ...input, userId: user.id });
  }

  @Post("availability")
  @HttpCode(201)
  async addAvailability(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const user = getSessionUser(request);
    const profile = await this.coaches.findProfileByUserId(user.id);
    if (!profile) throw new BadRequestException({ code: "COACH_PROFILE_REQUIRED" });
    const input = availabilitySchema.parse(body);
    return this.coaches.addAvailability({
      coachId: profile.id,
      startsAt: new Date(input.startsAt),
      endsAt: new Date(input.endsAt),
      location: input.location,
    });
  }

  @Post("admin/:id/verify")
  @HttpCode(200)
  async verify(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    requireSuperAdmin(request);
    return this.coaches.setVerification(id, "VERIFIED");
  }

  @Post("requests")
  @HttpCode(201)
  async createRequest(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const user = getSessionUser(request);
    const input = requestSchema.parse(body);
    return this.market.createRequest({
      playerId: user.id,
      targetCoachId: input.targetCoachId ?? null,
      startsAt: new Date(input.startsAt),
      endsAt: new Date(input.endsAt),
      location: input.location,
      groupSize: input.groupSize,
      skillLevel: input.skillLevel,
      goals: input.goals ?? null,
      notes: input.notes ?? null,
    });
  }

  @Get("requests/open")
  async openJobs() {
    return this.market.listOpenRequests(50);
  }

  @Get("requests/:id/offers")
  async offersForRequest(@Param("id") id: string) {
    return this.market.listOffersForRequest(id);
  }

  @Post("offers")
  @HttpCode(201)
  async makeOffer(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const user = getSessionUser(request);
    const profile = await this.coaches.findProfileByUserId(user.id);
    if (!profile) throw new BadRequestException({ code: "COACH_PROFILE_REQUIRED" });
    const input = offerSchema.parse(body);
    return this.market.createOffer({
      requestId: input.requestId,
      coachId: profile.id,
      amount: input.amount,
      message: input.message ?? null,
      expiresAt: new Date(input.expiresAt),
    });
  }

  @Post("offers/accept")
  @HttpCode(201)
  async acceptOffer(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const user = getSessionUser(request);
    const input = acceptSchema.parse(body);
    const result = await this.market.acceptOffer({ offerId: input.offerId, playerId: user.id });
    const coach = await this.coaches.findProfileById(result.booking.coachId);
    if (coach) {
      await this.notifier.dispatch([coach.userId], {
        type: "COACH_OFFER_ACCEPTED",
        title: "Your coaching offer was accepted",
        body: "A player accepted your offer. Await their payment proof.",
        data: { bookingId: result.booking.id },
      });
    }
    return result;
  }

  @Post("bookings/proof")
  @HttpCode(200)
  async proof(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const user = getSessionUser(request);
    const input = proofSchema.parse(body);
    return this.bookings.submitProof({ ...input, playerId: user.id });
  }

  @Post("bookings/proof/approve")
  @HttpCode(200)
  async approve(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const user = getSessionUser(request);
    const input = reviewSchema.parse(body);
    await this.assertCoachOwnsBooking(user.id, input.bookingId);
    const confirmed = await this.bookings.approveProof({
      submissionId: input.submissionId,
      bookingId: input.bookingId,
      reason: input.reason ?? null,
    });
    await this.notifier.dispatch([confirmed.playerId], {
      type: "COACH_BOOKING_CONFIRMED",
      title: "Your coaching session is confirmed",
      body: "The coach approved your payment. Your session is booked.",
      data: { bookingId: confirmed.id },
    });
    return confirmed;
  }

  @Post("bookings/proof/reject")
  @HttpCode(200)
  async reject(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const user = getSessionUser(request);
    const input = reviewSchema.parse(body);
    if (!input.reason) throw new BadRequestException({ code: "REJECTION_REASON_REQUIRED" });
    await this.assertCoachOwnsBooking(user.id, input.bookingId);
    const rejected = await this.bookings.rejectProof({
      submissionId: input.submissionId,
      bookingId: input.bookingId,
      reason: input.reason,
    });
    await this.notifier.dispatch([rejected.playerId], {
      type: "COACH_PROOF_REJECTED",
      title: "Coaching payment proof rejected",
      body: input.reason,
      data: { bookingId: rejected.id },
    });
    return rejected;
  }

  private async assertCoachOwnsBooking(userId: string, bookingId: string): Promise<void> {
    const profile = await this.coaches.findProfileByUserId(userId);
    const booking = await this.bookings.getBookingById(bookingId);
    if (!booking) throw new BadRequestException({ code: "COACH_BOOKING_NOT_FOUND" });
    if (!profile || booking.coachId !== profile.id) {
      throw new ForbiddenException({ code: "COACH_BOOKING_FORBIDDEN" });
    }
  }
}

function requireSuperAdmin(request: AuthenticatedRequest): void {
  const user = getSessionUser(request);
  if (!user.roles.includes("SUPER_ADMIN")) {
    throw new ForbiddenException({ code: "SUPER_ADMIN_REQUIRED" });
  }
}
