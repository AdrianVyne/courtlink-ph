import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  Avatar,
  Badge,
  Button,
  Card,
  CourtLines,
  EmptyState,
  Field,
  Input,
  Select,
  Skeleton,
  Stat,
  StatusPill,
} from "./index";

afterEach(cleanup);

describe("Button", () => {
  it("renders a button by default", () => {
    render(<Button>Book this court</Button>);
    expect(screen.getByRole("button", { name: "Book this court" })).toBeDefined();
  });

  it("renders a link when href is set", () => {
    render(<Button href="/courts">Find a court</Button>);
    const link = screen.getByRole("link", { name: "Find a court" });
    expect(link.getAttribute("href")).toBe("/courts");
  });

  it("is disabled and busy while loading", () => {
    render(<Button loading>Saving</Button>);
    const button = screen.getByRole("button");
    expect(button.hasAttribute("disabled")).toBe(true);
    expect(button.getAttribute("aria-busy")).toBe("true");
  });

  it("exposes its variant for styling", () => {
    render(<Button variant="danger">Cancel booking</Button>);
    expect(screen.getByRole("button").getAttribute("data-variant")).toBe("danger");
  });
});

describe("StatusPill", () => {
  it.each([
    ["CONFIRMED", "success"],
    ["completed", "success"],
    ["APPROVED", "success"],
    ["HELD", "pending"],
    ["PROOF_SUBMITTED", "pending"],
    ["PENDING_APPROVAL", "pending"],
    ["REFUND_REQUESTED", "pending"],
    ["REJECTED", "danger"],
    ["CANCELLED", "danger"],
    ["DECLINED", "danger"],
    ["EXPIRED", "danger"],
    ["SOMETHING_ELSE", "neutral"],
  ])("maps %s to the %s tone", (status, tone) => {
    render(<StatusPill status={status} />);
    expect(
      screen.getByText(status.replace(/_/g, " ").toLowerCase()).getAttribute("data-tone"),
    ).toBe(tone);
  });
});

describe("Field", () => {
  it("wires hint and error to the control via aria-describedby", () => {
    render(
      <Field label="Email" hint="Use your club email" error="Email is required">
        <Input name="email" />
      </Field>,
    );
    const input = screen.getByLabelText("Email");
    const describedBy = input.getAttribute("aria-describedby") ?? "";
    const hint = screen.getByText("Use your club email");
    const error = screen.getByText("Email is required");
    expect(describedBy.split(" ")).toContain(hint.id);
    expect(describedBy.split(" ")).toContain(error.id);
    expect(input.getAttribute("aria-invalid")).toBe("true");
  });

  it("renders a select control", () => {
    render(
      <Field label="Duration">
        <Select name="duration">
          <option value="60">1 hour</option>
        </Select>
      </Field>,
    );
    expect(screen.getByLabelText("Duration").tagName).toBe("SELECT");
  });
});

describe("EmptyState", () => {
  it("renders title, body, and action", () => {
    render(
      <EmptyState
        title="No venues match these filters"
        body="Try widening your search."
        action={<Button href="/courts">Reset filters</Button>}
      />,
    );
    expect(screen.getByText("No venues match these filters")).toBeDefined();
    expect(screen.getByText("Try widening your search.")).toBeDefined();
    expect(screen.getByRole("link", { name: "Reset filters" })).toBeDefined();
  });
});

describe("Skeleton", () => {
  it("is hidden from assistive technology", () => {
    const { container } = render(<Skeleton className="h-4 w-24" />);
    expect(container.firstElementChild?.getAttribute("aria-hidden")).toBe("true");
  });
});

describe("Stat", () => {
  it("renders value and label", () => {
    render(<Stat value="120" label="approved venues" />);
    expect(screen.getByText("120")).toBeDefined();
    expect(screen.getByText("approved venues")).toBeDefined();
  });
});

describe("Avatar", () => {
  it("renders initials from the name", () => {
    render(<Avatar name="Maria Santos" />);
    expect(screen.getByText("MS")).toBeDefined();
  });
});

describe("Badge and Card", () => {
  it("render their children", () => {
    render(
      <Card>
        <Badge>Indoor</Badge>
      </Card>,
    );
    expect(screen.getByText("Indoor")).toBeDefined();
  });
});

describe("CourtLines", () => {
  it("renders decorative svg court geometry", () => {
    const { container } = render(<CourtLines variant="field" />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
  });
});
