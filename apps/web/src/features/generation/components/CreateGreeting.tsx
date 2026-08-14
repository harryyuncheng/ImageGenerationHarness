import { useState } from 'react';
import { selectCreateGreeting } from '../greeting.js';

export function CreateGreeting() {
  const [greeting] = useState(() => selectCreateGreeting(new Date()));
  return (
    <section className="greeting-section">
      <h2 className="create-greeting">{greeting}</h2>
    </section>
  );
}
