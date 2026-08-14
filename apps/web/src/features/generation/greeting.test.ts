import { describe, expect, it } from 'vitest';
import { selectCreateGreeting } from './greeting.js';

describe('create greeting', () => {
  function greetingPoolAt(hour: number): string[] {
    const greetings = new Set<string>();
    for (let index = 0; index < 1000; index += 1) {
      greetings.add(selectCreateGreeting(new Date(2026, 7, 7, hour), () => index / 1000));
    }
    return [...greetings];
  }

  it('selects once from the local time and day-specific greeting pool', () => {
    expect(selectCreateGreeting(new Date(2026, 7, 7, 10), () => 0.999)).toBe(
      'A final flourish for Friday',
    );
    expect(selectCreateGreeting(new Date(2026, 7, 8, 10), () => 0.999)).toBe(
      'A slower morning, a brighter canvas',
    );
    expect(selectCreateGreeting(new Date(2026, 7, 7, 15), () => 0)).toBe(
      'Afternoon, Harry. What are you imagining?',
    );
    expect(selectCreateGreeting(new Date(2026, 7, 7, 23), () => 0)).toBe(
      'A late-night canvas, ready when you are',
    );
  });

  it('keeps time-specific copy within its local-time window', () => {
    const morningGreetings = [
      'Morning, Harry. What shall we picture?',
      'A bright morning for making something new',
      'Morning light, blank canvas',
      'A new day for a new perspective',
      'Fresh ideas look good in the morning',
    ];
    const afternoonGreetings = [
      'Afternoon, Harry. What are you imagining?',
      'A little daylight, a lot of possibility',
      'The afternoon is open for invention',
    ];
    const eveningGreetings = [
      'Evening, Harry. What shall we create?',
      'The evening has room for another idea',
      'What are you picturing tonight?',
      'The day can end. The ideas can stay.',
      'An evening canvas, waiting',
      'A quiet evening for vivid thinking',
    ];
    const nightGreetings = [
      'A quiet hour for something vivid',
      'The imagination stays bright after dark',
      'Night shift, creative edition',
      'Some ideas only arrive after dark',
      'The quiet hours suit bold ideas',
      'After dark, imagination takes the lead',
      'The world is quiet. The canvas is open.',
      'Moonlight makes room for unusual ideas',
      'Night settles in, ideas take shape',
    ];
    const lateNightGreetings = [
      'A late-night canvas, ready when you are',
      'Late hours, vivid ideas',
      "Let's follow that late-night thought",
    ];

    expect(greetingPoolAt(5)).not.toEqual(expect.arrayContaining(morningGreetings));
    expect(greetingPoolAt(6)).toEqual(expect.arrayContaining(morningGreetings));
    expect(greetingPoolAt(12)).not.toEqual(expect.arrayContaining(morningGreetings));
    expect(greetingPoolAt(12)).toEqual(expect.arrayContaining(afternoonGreetings));
    expect(greetingPoolAt(17)).not.toEqual(expect.arrayContaining(afternoonGreetings));
    expect(greetingPoolAt(17)).toEqual(expect.arrayContaining(eveningGreetings));
    expect(greetingPoolAt(20)).not.toEqual(expect.arrayContaining(nightGreetings));
    expect(greetingPoolAt(20)).not.toEqual(expect.arrayContaining(lateNightGreetings));
    expect(greetingPoolAt(21)).not.toEqual(expect.arrayContaining(eveningGreetings));
    expect(greetingPoolAt(21)).toEqual(expect.arrayContaining(nightGreetings));
    expect(greetingPoolAt(22)).not.toEqual(expect.arrayContaining(lateNightGreetings));
    expect(greetingPoolAt(23)).toEqual(expect.arrayContaining(lateNightGreetings));
    expect(greetingPoolAt(0)).not.toContain('Night settles in, ideas take shape');
    expect(greetingPoolAt(4)).not.toEqual(expect.arrayContaining(lateNightGreetings));
    expect(greetingPoolAt(6)).not.toEqual(expect.arrayContaining(nightGreetings));
    expect(greetingPoolAt(6)).not.toEqual(expect.arrayContaining(lateNightGreetings));
  });
});
