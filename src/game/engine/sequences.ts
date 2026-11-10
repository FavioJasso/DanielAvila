/**
 * A tiny timeline: a sequence is a list of steps run one after the other,
 * and the runner plays at most one sequence at a time.
 *
 * Every scripted moment of the game (intro, dive into a painting, backflip
 * out, star pose) goes through the single runner in game.ts. Starting a new
 * sequence cancels the old one, and a cancelled sequence is told so through
 * its `onEnd` callback so it can put the world back into a sane state. That
 * is what makes the scripted moments safe to interrupt at any frame.
 *
 * Steps are created when a sequence starts (a user action), never per frame.
 */

export interface Step {
  /** Runs once when the step becomes current. */
  enter?(): void;
  /**
   * Runs every frame while current; `t` is the time since `enter`. Return
   * true when finished. A step without `update` finishes immediately.
   */
  update?(dt: number, t: number): boolean;
}

/** Called once when a sequence stops: `completed` is false if it was cancelled. */
export type SequenceEnd = (completed: boolean) => void;

export class SequenceRunner {
  private steps: Step[] = [];
  private index = 0;
  private time = 0;
  private onEnd: SequenceEnd | null = null;
  private current: string | null = null;
  /** Bumped whenever the running sequence changes, to detect re-entrancy. */
  private generation = 0;

  /** Name of the running sequence, or null. */
  get active(): string | null {
    return this.current;
  }

  /** Cancel whatever is running and start `steps`. */
  play(name: string, steps: Step[], onEnd?: SequenceEnd): void {
    this.cancel();
    this.generation++;
    this.current = name;
    this.steps = steps;
    this.index = 0;
    this.time = 0;
    this.onEnd = onEnd ?? null;
    if (steps.length === 0) {
      this.finish(true);
      return;
    }
    const generation = this.generation;
    steps[0].enter?.();
    // a step may itself have replaced or finished the sequence
    if (generation === this.generation) this.advance(0);
  }

  /** Stop the running sequence and let it clean up (`onEnd(false)`). */
  cancel(): void {
    if (this.current !== null) this.finish(false);
  }

  /** Drop the running sequence without telling it (engine teardown). */
  clear(): void {
    this.generation++;
    this.current = null;
    this.steps = [];
    this.onEnd = null;
  }

  update(dt: number): void {
    if (this.current !== null) this.advance(dt);
  }

  private advance(dt: number): void {
    const generation = this.generation;
    let stepDt = dt;
    for (;;) {
      const step = this.steps[this.index];
      this.time += stepDt;
      const done = step.update ? step.update(stepDt, this.time) : true;
      if (generation !== this.generation) return; // replaced or cancelled inside the step
      if (!done) return;
      this.index++;
      this.time = 0;
      // steps that follow in the same frame get no extra time
      stepDt = 0;
      if (this.index >= this.steps.length) {
        this.finish(true);
        return;
      }
      this.steps[this.index].enter?.();
      if (generation !== this.generation) return;
    }
  }

  private finish(completed: boolean): void {
    const end = this.onEnd;
    this.generation++;
    this.current = null;
    this.steps = [];
    this.onEnd = null;
    end?.(completed);
  }
}

/* ---------------------------- step builders ---------------------------- */

/** Run a function and move on at once. */
export const call = (fn: () => void): Step => ({ enter: fn });

/** Do nothing for `seconds`. */
export const wait = (seconds: number): Step => ({
  update: (_dt, t) => t >= seconds,
});

/** Call `fn(k)` every frame with k going 0 → 1 over `seconds`. */
export const tween = (seconds: number, fn: (k: number) => void): Step => ({
  update(_dt, t) {
    const k = seconds <= 0 ? 1 : Math.min(1, t / seconds);
    fn(k);
    return k >= 1;
  },
});

/**
 * Wait until `done()` is true, giving up after `timeout` seconds so that a
 * condition which never comes true cannot hang the game. `each` runs every
 * frame while waiting.
 */
export const until = (
  done: () => boolean,
  timeout: number,
  each?: (dt: number) => void,
): Step => ({
  update(dt, t) {
    if (done() || t >= timeout) return true;
    each?.(dt);
    return false;
  },
});
