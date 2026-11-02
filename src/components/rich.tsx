/** Слова в звёздочках (*слово*) показываются выделенными: в вопросах так отмечено слово, о котором спрашивают. */
export function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*[^*\n]+\*)/g).map((part, i) =>
        part.length > 2 && part.startsWith("*") && part.endsWith("*")
          ? <strong key={i} className="rounded bg-sun-soft px-0.5 underline decoration-2 underline-offset-2">{part.slice(1, -1).trim()}</strong>
          : <span key={i}>{part}</span>,
      )}
    </>
  );
}
