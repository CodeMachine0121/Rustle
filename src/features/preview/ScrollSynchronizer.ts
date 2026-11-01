export type ScrollSide = "editor" | "preview";

/** One side of the sync, in its own pixels and in zero-based body lines. */
export type ScrollPane = {
  position(): number;
  maximumPosition(): number;
  lineAtTop(): number;
  positionForLine(line: number): number;
  scrollTo(position: number): void;
};

export type AttachedScrollPane = {
  /** Call on every scroll event of the pane. */
  scrolled: () => void;
  detach: () => void;
};

// Browsers round scroll positions to device pixels.
const SAME_POSITION_TOLERANCE = 1;

/**
 * Keeps the editor and the preview on the same body line. The side the
 * writer scrolls leads and the other follows. The follower's own scroll
 * event for that move is recognised by its position, not by a timer, and
 * eaten once, so the two never chase each other.
 */
export class ScrollSynchronizer {
  readonly #panes = new Map<ScrollSide, ScrollPane>();
  readonly #echoes = new Map<ScrollSide, number>();

  attach(side: ScrollSide, pane: ScrollPane): AttachedScrollPane {
    this.#panes.set(side, pane);
    this.#echoes.delete(side);
    return {
      scrolled: () => {
        if (this.#panes.get(side) === pane) {
          this.#follow(side, pane);
        }
      },
      detach: () => {
        if (this.#panes.get(side) === pane) {
          this.#panes.delete(side);
          this.#echoes.delete(side);
        }
      },
    };
  }

  #follow(side: ScrollSide, leader: ScrollPane): void {
    const echo = this.#echoes.get(side);
    this.#echoes.delete(side);
    if (echo !== undefined && isSamePosition(leader.position(), echo)) {
      return;
    }
    const followerSide: ScrollSide = side === "editor" ? "preview" : "editor";
    const follower = this.#panes.get(followerSide);
    if (follower === undefined) {
      return;
    }
    const before = follower.position();
    const target = followingPosition(leader, follower);
    if (isSamePosition(before, target)) {
      return;
    }
    follower.scrollTo(target);
    const after = follower.position();
    if (!isSamePosition(before, after)) {
      this.#echoes.set(followerSide, after);
    }
  }
}

function followingPosition(leader: ScrollPane, follower: ScrollPane): number {
  const maximum = follower.maximumPosition();
  const leaderPosition = leader.position();
  if (leaderPosition <= 0) {
    return 0;
  }
  if (leaderPosition >= leader.maximumPosition() - SAME_POSITION_TOLERANCE) {
    return maximum;
  }
  return Math.min(maximum, Math.max(0, follower.positionForLine(leader.lineAtTop())));
}

function isSamePosition(first: number, second: number): boolean {
  return Math.abs(first - second) < SAME_POSITION_TOLERANCE;
}
