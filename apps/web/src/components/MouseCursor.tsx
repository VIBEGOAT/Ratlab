import { useEffect, useRef } from "react";

/** A small lab-mouse pointer for precise, fine-pointer devices. */
export function MouseCursor() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const fine = matchMedia("(hover: hover) and (pointer: fine)");
    const reduce = matchMedia("(prefers-reduced-motion: reduce)");
    if (!fine.matches || reduce.matches) return;
    const node = ref.current;
    if (!node) return;
    let x = -30, y = -30, tx = -30, ty = -30, frame = 0;
    const draw = () => {
      x += (tx - x) * 0.34; y += (ty - y) * 0.34;
      node.style.transform = `translate3d(${x}px,${y}px,0) rotate(-24deg)`;
      frame = requestAnimationFrame(draw);
    };
    const move = (event: PointerEvent) => { tx = event.clientX + 3; ty = event.clientY + 4; node.dataset.visible = "true"; };
    const leave = () => { delete node.dataset.visible; };
    const down = () => { node.dataset.pressed = "true"; };
    const up = () => { delete node.dataset.pressed; };
    document.documentElement.classList.add("mouse-cursor-on");
    addEventListener("pointermove", move, { passive: true });
    addEventListener("pointerdown", down, { passive: true });
    addEventListener("pointerup", up, { passive: true });
    document.documentElement.addEventListener("mouseleave", leave);
    frame = requestAnimationFrame(draw);
    return () => {
      document.documentElement.classList.remove("mouse-cursor-on");
      removeEventListener("pointermove", move); removeEventListener("pointerdown", down); removeEventListener("pointerup", up);
      document.documentElement.removeEventListener("mouseleave", leave); cancelAnimationFrame(frame);
    };
  }, []);
  return <div className="mouse-cursor" ref={ref} aria-hidden="true"><i className="mouse-ear one" /><i className="mouse-ear two" /><i className="mouse-eye" /><i className="mouse-tail" /></div>;
}
