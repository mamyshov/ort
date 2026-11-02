/** Декоративные облачка диалога для верхних блоков. Английские фразы — часть образа, не интерфейс. */
export function HeroBubbles() {
  return (
    <div aria-hidden="true" className="pointer-events-none relative h-28 w-full select-none sm:h-36 md:h-56">
      <span className="absolute right-2 top-0 rounded-3xl rounded-br-md bg-white px-5 py-3 text-lg font-extrabold text-ink shadow-card sm:text-xl">
        Hello! 👋
      </span>
      <span className="absolute bottom-0 right-16 rounded-3xl rounded-bl-md bg-sun px-5 py-3 text-lg font-extrabold text-ink sm:right-28 sm:text-xl">
        How are you?
      </span>
    </div>
  );
}
