declare module "canvas-confetti" {
  type Origin = {
    x?: number;
    y?: number;
  };

  type Options = {
    particleCount?: number;
    spread?: number;
    origin?: Origin;
  };

  export default function confetti(options?: Options): Promise<null> | null;
}
