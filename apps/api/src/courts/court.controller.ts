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
import { type AuthenticatedRequest, Public, getSessionUser } from "../auth/session.guard.js";
// biome-ignore lint/style/useImportType: TenancyService is injected at runtime.
import { TenancyService } from "../tenancy/tenancy.service.js";
// biome-ignore lint/style/useImportType: VenueService is injected at runtime.
import { VenueService } from "../venues/venue.service.js";
// biome-ignore lint/style/useImportType: BookingService is injected at runtime.
import { BookingService } from "./booking.service.js";
// biome-ignore lint/style/useImportType: CourtService is injected at runtime.
import { CourtService } from "./court.service.js";
// biome-ignore lint/style/useImportType: BookingQueryService is injected at runtime.
import { BookingQueryService } from "./booking-query.service.js";
// biome-ignore lint/style/useImportType: RefundService is injected at runtime.
import { RefundService } from "./refund.service.js";
import { OBJECT_STORAGE } from "../auth/tokens.js";
import {
  type ObjectStorage,
  assertProofContentType,
  assertProofSize,
  buildProofObjectKey,
} from "../storage/object-storage.js";

const createCourtSchema = z.object({
  venueId: z.string().uuid(),
  name: z.string().min(1).max(80),
  description: z.string().max(2000).optional().nullable(),
  indoor: z.boolean().optional(),
  slotIncrementMin: z.number().int().min(15).max(120).optional(),
  minimumDurationMin: z.number().int().min(30).max(480).optional(),
  maximumDurationMin: z.number().int().min(30).max(720).optional(),
});

const quoteSchema = z.object({
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
});

const submitProofSchema = z.object({
  bookingId: z.string().uuid(),
  channel: z.enum(["GCASH", "MAYA", "QR_PH", "BANK_TRANSFER", "OTHER"]),
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
  channel: z.enum(["GCASH", "MAYA", "QR_PH", "BANK_TRANSFER", "OTHER"]),
  transactionRef: z.string().min(2).max(120),
});

const venueCancelSchema = z.object({
  bookingId: z.string().uuid(),
  reason: z.string().min(2).max(500),
});

@Controller({ path: "courts", version: "1" })
export class CourtController {
  constructor(
    private readonly courts: CourtService,
    private readonly bookings: BookingService,
    private readonly bookingQuery: BookingQueryService,
    private readonly refunds: RefundService,
    private readonly tenancy: TenancyService,
    private readonly venues: VenueService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  @Public()
  @Get(":id")
  async detail(@Param("id") id: string) {
    const court = await this.courts.findCourtById(id);
    if (!court) throw new BadRequestException({ code: "COURT_NOT_FOUND" });
    return court;
  }

  @Public()
  @Get(":id/quote")
  async quote(@Param("id") id: string, @Query() query: Record<string, string>) {
    const input = quoteSchema.parse(query);
    return this.bookings.quote(id, {
      startsAt: new Date(input.startsAt),
      endsAt: new Date(input.endsAt),
    });
  }

  @Post(":id/hold")
  @HttpCode(201)
  async hold(@Req() request: AuthenticatedRequest, @Param("id") id: string, @Body() body: unknown) {
    const user = getSessionUser(request);
    const input = quoteSchema.parse(body);
    return this.bookings.createHold({
      courtId: id,
      playerId: user.id,
      startsAt: new Date(input.startsAt),
      endsAt: new Date(input.endsAt),
    });
  }

  @Get("bookings/mine")
  async myBookings(@Req() request: AuthenticatedRequest) {
    const user = getSessionUser(request);
    return this.bookingQuery.listForPlayer(user.id);
  }

  @Get("bookings/queue")
  async venueQueue(@Req() request: AuthenticatedRequest) {
    const user = getSessionUser(request);
    const venueIds = await this.managedVenueIds(user.id);
    return this.bookingQuery.listVenueQueue(venueIds, ["PROOF_SUBMITTED", "REFUND_REQUESTED"]);
  }

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
    const channel = uploadFieldsSchema.parse({
      channel: file.fields.channel?.value,
      transactionRef: file.fields.transactionRef?.value,
    });
    const objectKey = buildProofObjectKey("court", bookingId, contentType);
    await this.storage.putObject({ key: objectKey, body: buffer, contentType });
    return this.bookings.submitProof({
      bookingId,
      playerId: user.id,
      channel: channel.channel,
      transactionRef: channel.transactionRef,
      proofObjectKey: objectKey,
    });
  }

  @Get("bookings/proof/:submissionId/url")
  async proofDownloadUrl(
    @Req() request: AuthenticatedRequest,
    @Param("submissionId") submissionId: string,
  ) {
    const user = getSessionUser(request);
    const submission = await this.bookings.getSubmissionById(submissionId);
    if (!submission) throw new BadRequestException({ code: "SUBMISSION_NOT_FOUND" });
    await this.assertVenueStaff(user.id, submission.bookingId);
    const url = await this.storage.getSignedDownloadUrl(submission.proofObjectKey, 300);
    return { url, expiresInSeconds: 300 };
  }

  @Post("bookings/proof")
  @HttpCode(200)
  async proof(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const user = getSessionUser(request);
    const input = submitProofSchema.parse(body);
    return this.bookings.submitProof({ ...input, playerId: user.id });
  }

  @Post("bookings/proof/approve")
  @HttpCode(200)
  async approve(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const user = getSessionUser(request);
    const input = reviewSchema.parse(body);
    await this.assertVenueStaff(user.id, input.bookingId);
    return this.bookings.approveProof({
      submissionId: input.submissionId,
      bookingId: input.bookingId,
      reviewedById: user.id,
      reason: input.reason ?? null,
    });
  }

  @Post("bookings/proof/reject")
  @HttpCode(200)
  async reject(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const user = getSessionUser(request);
    const input = reviewSchema.parse(body);
    if (!input.reason) throw new BadRequestException({ code: "REJECTION_REASON_REQUIRED" });
    await this.assertVenueStaff(user.id, input.bookingId);
    return this.bookings.rejectProof({
      submissionId: input.submissionId,
      bookingId: input.bookingId,
      reviewedById: user.id,
      reason: input.reason,
    });
  }

  @Post("bookings/refund/request")
  @HttpCode(201)
  async requestRefund(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const user = getSessionUser(request);
    const input = refundRequestSchema.parse(body);
    return this.refunds.requestRefund({
      bookingId: input.bookingId,
      playerId: user.id,
      reason: input.reason,
    });
  }

  @Post("bookings/refund/decide")
  @HttpCode(200)
  async decideRefund(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const user = getSessionUser(request);
    const input = refundDecisionSchema.parse(body);
    await this.assertVenueStaff(user.id, input.bookingId);
    return this.refunds.decideRefund({ refundId: input.refundId, decision: input.decision });
  }

  @Post("bookings/refund/complete")
  @HttpCode(200)
  async completeRefund(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const user = getSessionUser(request);
    const input = refundCompleteSchema.parse(body);
    await this.assertVenueStaff(user.id, input.bookingId);
    return this.refunds.completeRefund({
      refundId: input.refundId,
      channel: input.channel,
      transactionRef: input.transactionRef,
    });
  }

  @Post("bookings/cancel-by-venue")
  @HttpCode(200)
  async cancelByVenue(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    const user = getSessionUser(request);
    const input = venueCancelSchema.parse(body);
    await this.assertVenueStaff(user.id, input.bookingId);
    return this.refunds.cancelByVenue({ bookingId: input.bookingId, reason: input.reason });
  }

  @Post("venues/:venueId")
  @HttpCode(201)
  async createCourt(
    @Req() request: AuthenticatedRequest,
    @Param("venueId") venueId: string,
    @Body() body: unknown,
  ) {
    const user = getSessionUser(request);
    const venue = await this.venues.findVenueById(venueId);
    if (!venue) throw new BadRequestException({ code: "VENUE_NOT_FOUND" });
    await this.tenancy.assertRole(user.id, venue.businessId, ["OWNER", "MANAGER"]);
    const input = createCourtSchema.parse({ ...((body as object) ?? {}), venueId });
    return this.courts.createCourt(input);
  }

  @Public()
  @Get("venues/:venueId/list")
  async listForVenue(@Param("venueId") venueId: string) {
    return this.courts.listCourtsForVenue(venueId);
  }

  private async managedVenueIds(userId: string): Promise<string[]> {
    const memberships = await this.tenancy.listMyMemberships(userId);
    const lists = await Promise.all(
      memberships.map((m) => this.venues.listVenuesForBusiness(m.businessId)),
    );
    return lists.flat().map((venue) => venue.id);
  }

  private async assertVenueStaff(userId: string, bookingId: string): Promise<void> {
    const booking = await this.bookings.getBookingById(bookingId);
    if (!booking) throw new BadRequestException({ code: "BOOKING_NOT_FOUND" });
    const court = await this.courts.findCourtById(booking.courtId);
    if (!court) throw new BadRequestException({ code: "COURT_NOT_FOUND" });
    const venue = await this.venues.findVenueById(court.venueId);
    if (!venue) throw new BadRequestException({ code: "VENUE_NOT_FOUND" });
    try {
      await this.tenancy.assertRole(userId, venue.businessId, ["OWNER", "MANAGER", "STAFF"]);
    } catch {
      throw new ForbiddenException({ code: "BOOKING_FORBIDDEN" });
    }
  }
}
