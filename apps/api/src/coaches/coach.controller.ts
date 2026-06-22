import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import { z } from "zod";
import { Idempotent } from "../idempotency/idempotent.decorator.js";
import { type AuthenticatedRequest, Public, getSessionUser } from "../auth/session.guard.js";
// biome-ignore lint/style/useImportType: CoachBookingService is injected at runtime.
import { CoachBookingService } from "./coach-booking.service.js";
// biome-ignore lint/style/useImportType: CoachMarketService is injected at runtime.
import { CoachMarketService } from "./coach-market.service.js";
// biome-ignore lint/style/useImportType: CoachRefundService is injected at runtime.
import { CoachRefundService } from "./coach-refund.service.js";
// biome-ignore lint/style/useImportType: CoachService is injected at runtime.
import { CoachService } from "./coach.service.js";
// biome-ignore lint/style/useImportType: NotificationDispatcher is injected at runtime.
import { NotificationDispatcher } from "../notifications/notification.dispatcher.js";
// biome-ignore lint/style/useImportType: CoachQueryService is injected at runtime.
import { CoachQueryService } from "./coach-query.service.js";
import { OBJECT_STORAGE } from "../auth/tokens.js";
import {
  type ObjectStorage,
  assertProofContentType,
  assertProofSize,
  buildProofObjectKey,
} from "../storage/object-storage.js";

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

const uploadFieldsSchema = z.object({
  channel: z.enum(["GCASH", "MAYA", "QR_PH", "BANK_TRANSFER", "OTHER"]),
  transactionRef: z.string().min(2).max(120),
});

const reviewSchema = z.object({
  submissionId: z.string().uuid(),
  bookingId: z.string().uuid(),
  reason: z.string().max(500).optional().nullable(),
});

const refundRequestSchema = z.object({
  bookingId: z.string().uuid(),
  reason: z.string().min(2).max(500),
});

const refundDecisionSchema = z.object({
  refundId: z.string().uuid(),
  bookingId: z.string().uuid(),
  decision: z.enum(["APPROVED", "REJECTED"]),
});

const refundCompleteSchema = z.object({
  refundId: z.string().uuid(),
  bookingId: z.string().uuid(),
  channel: channelEnum,
  transactionRef: z.string().min(2).max(120),
});

const coachCancelSchema = z.object({
  bookingId: z.string().uuid(),
  reason: z.string().min(2).max(500),
});

@Controller({ path: "coaches", version: "1" })
export class CoachController {
  constructor(
    private readonly coaches: CoachService,
    private readonly market: CoachMarketService,
    private readonly bookings: CoachBookingService,
    private readonly bookingQuery: CoachQueryService,
    private readonly refunds: CoachRefundService,
    private readonly notifier: NotificationDispatcher,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  @Public()
  @Get()
  async listPublic(@Query("verifiedOnly") verifiedOnly?: string) {
    return this.coaches.listPublicProfiles({ verifiedOnly: verifiedOnly === "true" });
  }

  @Get("me")
  async myCoachProfile(@Req() request: AuthenticatedRequest) {
    const user = getSessionUser(request);
    const profile = await this.coaches.findProfileByUserId(user.id);
    if (!profile) return { profile: null, availability: [] };
    const availability = await this.coaches.listAvailability(profile.id);
    return { profile, availability };
  }

  @Get("me/bookings")
  async myCoachBookings(@Req() request: AuthenticatedRequest) {
    const user = getSessionUser(request);
    const profile = await this.coaches.findProfileByUserId(user.id);
    if (!profile) return [];
    return this.bookingQuery.listBookingsForCoach(profile.id);
  }

  @Get("requests/mine")
  async myRequests(@Req() request: AuthenticatedRequest) {
    const user = getSessionUser(request);
    return this.bookingQuery.listRequestsForPlayer(user.id);
  }

  @Get("requests/directed")
  async myDirectedRequests(@Req() request: AuthenticatedRequest) {
    const profile = await this.requireCoachProfile(request);
    return this.bookingQuery.listDirectedPendingForCoach(profile.id);
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

  @Idempotent()
  @Post("requests")
  @HttpCode(201)
  async createRequest(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const user = getSessionUser(request);
    const input = requestSchema.parse(body);
    const created = await this.market.createRequest({
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
    if (created.targetCoachId) {
      const coach = await this.coaches.findProfileById(created.targetCoachId);
      if (coach) {
        await this.notifier.dispatch([coach.userId], {
          type: "COACH_REQUEST_DIRECTED",
          title: "A player requested you directly",
          body: "Review and approve or decline this directed coaching request.",
          data: { requestId: created.id },
        });
      }
    }
    return created;
  }

  @Get("requests/open")
  async openJobs() {
    return this.market.listOpenRequests(50);
  }

  @Get("requests/:id/offers")
  async offersForRequest(@Param("id") id: string) {
    return this.market.listOffersForRequest(id);
  }

  @Idempotent()
  @Post("requests/:id/approve")
  @HttpCode(200)
  async approveRequest(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    const profile = await this.requireCoachProfile(request);
    const updated = await this.market.approveDirectedRequest({
      requestId: id,
      coachId: profile.id,
    });
    await this.notifier.dispatch([updated.playerId], {
      type: "COACH_REQUEST_APPROVED",
      title: "A coach approved your request",
      body: "Your directed coaching request was approved. Await the coach's offer.",
      data: { requestId: updated.id },
    });
    return updated;
  }

  @Idempotent()
  @Post("requests/:id/decline")
  @HttpCode(200)
  async declineRequest(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    const profile = await this.requireCoachProfile(request);
    const updated = await this.market.declineDirectedRequest({
      requestId: id,
      coachId: profile.id,
    });
    await this.notifier.dispatch([updated.playerId], {
      type: "COACH_REQUEST_DECLINED",
      title: "A coach declined your request",
      body: "Your directed coaching request was declined. You can send an open request instead.",
      data: { requestId: updated.id },
    });
    return updated;
  }

  @Idempotent()
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

  @Idempotent()
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

  @Idempotent()
  @Post("bookings/:id/proof-upload")
  @HttpCode(200)
  async uploadProof(@Req() request: AuthenticatedRequest, @Param("id") bookingId: string) {
    const user = getSessionUser(request);
    const multipart = request as unknown as {
      file(): Promise<
        | {
            mimetype: string;
            toBuffer(): Promise<Buffer>;
            fields: Record<string, { value?: string } | undefined>;
          }
        | undefined
      >;
    };
    const file = await multipart.file();
    if (!file) throw new BadRequestException({ code: "PROOF_FILE_REQUIRED" });
    const contentType = assertProofContentType(file.mimetype);
    const buffer = await file.toBuffer();
    assertProofSize(buffer.length);
    const fields = uploadFieldsSchema.parse({
      channel: file.fields.channel?.value,
      transactionRef: file.fields.transactionRef?.value,
    });
    const objectKey = buildProofObjectKey("coach", bookingId, contentType);
    await this.storage.putObject({ key: objectKey, body: buffer, contentType });
    return this.bookings.submitProof({
      bookingId,
      playerId: user.id,
      channel: fields.channel,
      transactionRef: fields.transactionRef,
      proofObjectKey: objectKey,
    });
  }

  @Idempotent()
  @Post("bookings/proof")
  @HttpCode(200)
  async proof(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const user = getSessionUser(request);
    const input = proofSchema.parse(body);
    return this.bookings.submitProof({ ...input, playerId: user.id });
  }

  @Idempotent()
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

  @Idempotent()
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

  @Idempotent()
  @Post("bookings/refund/request")
  @HttpCode(201)
  async requestRefund(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const user = getSessionUser(request);
    const input = refundRequestSchema.parse(body);
    const refund = await this.refunds.requestRefund({
      bookingId: input.bookingId,
      playerId: user.id,
      reason: input.reason,
    });
    const booking = await this.bookings.getBookingById(input.bookingId);
    if (booking) {
      const coach = await this.coaches.findProfileById(booking.coachId);
      if (coach) {
        await this.notifier.dispatch([coach.userId], {
          type: "COACH_REFUND_REQUESTED",
          title: "A player requested a coaching refund",
          body: input.reason,
          data: { bookingId: input.bookingId, refundId: refund.id },
        });
      }
    }
    return refund;
  }

  @Idempotent()
  @Post("bookings/refund/decide")
  @HttpCode(200)
  async decideRefund(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const user = getSessionUser(request);
    const input = refundDecisionSchema.parse(body);
    await this.assertCoachOwnsBooking(user.id, input.bookingId);
    const refund = await this.refunds.decideRefund({
      refundId: input.refundId,
      decision: input.decision,
    });
    const booking = await this.bookings.getBookingById(input.bookingId);
    if (booking) {
      await this.notifier.dispatch([booking.playerId], {
        type: "COACH_REFUND_DECIDED",
        title: refund.status === "APPROVED" ? "Refund approved" : "Refund rejected",
        body:
          refund.status === "APPROVED"
            ? "Your coaching refund was approved and the session was cancelled."
            : "Your coaching refund request was rejected.",
        data: { bookingId: input.bookingId, refundId: refund.id },
      });
    }
    return refund;
  }

  @Idempotent()
  @Post("bookings/refund/complete")
  @HttpCode(200)
  async completeRefund(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const user = getSessionUser(request);
    const input = refundCompleteSchema.parse(body);
    await this.assertCoachOwnsBooking(user.id, input.bookingId);
    return this.refunds.completeRefund({
      refundId: input.refundId,
      channel: input.channel,
      transactionRef: input.transactionRef,
    });
  }

  @Idempotent()
  @Post("bookings/cancel-by-coach")
  @HttpCode(200)
  async cancelByCoach(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const user = getSessionUser(request);
    const input = coachCancelSchema.parse(body);
    await this.assertCoachOwnsBooking(user.id, input.bookingId);
    const refund = await this.refunds.cancelByCoach({
      bookingId: input.bookingId,
      reason: input.reason,
    });
    const booking = await this.bookings.getBookingById(input.bookingId);
    if (booking) {
      await this.notifier.dispatch([booking.playerId], {
        type: "COACH_BOOKING_CANCELLED",
        title: "Your coaching session was cancelled by the coach",
        body: input.reason,
        data: { bookingId: input.bookingId, refundId: refund.id },
      });
    }
    return refund;
  }

  private async requireCoachProfile(
    request: AuthenticatedRequest,
  ): Promise<{ id: string; userId: string }> {
    const user = getSessionUser(request);
    const profile = await this.coaches.findProfileByUserId(user.id);
    if (!profile) throw new BadRequestException({ code: "COACH_PROFILE_REQUIRED" });
    return profile;
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
