import { useCallback, useEffect, useRef, useState } from 'react';

export function useToast() {
  const [message, setMessage] = useState('');
  const timer = useRef();
  const show = useCallback((text) => {
    setMessage(text);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(''), 3000);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  const node = message ? (
    <div
      role="status"
      className="fixed top-4 inset-x-0 mx-auto w-fit max-w-[90vw] z-50 bg-primary text-white text-sm font-semibold px-4 py-2.5 rounded-full shadow-lg"
    >
      {message}
    </div>
  ) : null;
  return [show, node];
}
