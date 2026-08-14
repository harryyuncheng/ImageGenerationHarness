interface CreateGreeting {
  text: string;
  days?: readonly number[];
  period: keyof typeof createGreetingPeriods;
}

const createGreetingPeriods = {
  morning: [6, 12],
  afternoon: [12, 17],
  evening: [17, 21],
  night: [21, 6],
  nightfall: [21, 24],
  lateNight: [23, 4],
} as const satisfies Record<string, readonly [start: number, end: number]>;

const createGreetings: readonly CreateGreeting[] = [
  { text: 'Morning, Harry. What shall we picture?', period: 'morning' },
  { text: 'A fresh canvas for a fresh start', period: 'morning' },
  { text: 'A bright morning for making something new', period: 'morning' },
  { text: 'Where should your imagination wander first?', period: 'morning' },
  { text: 'Start with a spark, Harry', period: 'morning' },
  { text: 'Today has room for something new', period: 'morning' },
  { text: 'Morning light, blank canvas', period: 'morning' },
  { text: 'A new day for a new perspective', period: 'morning' },
  { text: 'Fresh ideas look good in the morning', period: 'morning' },
  { text: 'Begin anywhere, Harry', period: 'morning' },
  { text: 'New week, new canvas', days: [1], period: 'morning' },
  { text: 'A Tuesday made for fresh ideas', days: [2], period: 'morning' },
  { text: 'Midweek, with room to imagine', days: [3], period: 'morning' },
  { text: 'Thursday has something in mind', days: [4], period: 'morning' },
  { text: 'A final flourish for Friday', days: [5], period: 'morning' },
  { text: 'Weekend ideas, ready when you are', days: [0, 6], period: 'morning' },
  { text: 'A slower morning, a brighter canvas', days: [0, 6], period: 'morning' },
  { text: 'Afternoon, Harry. What are you imagining?', period: 'afternoon' },
  { text: 'Ready to turn a thought into an image?', period: 'afternoon' },
  { text: 'What should take shape next?', period: 'afternoon' },
  { text: 'The canvas is ready when you are', period: 'afternoon' },
  { text: 'A good hour to make something unexpected', period: 'afternoon' },
  { text: 'What would you like to bring into view?', period: 'afternoon' },
  { text: "Let's give that idea a shape", period: 'afternoon' },
  { text: 'Your next image starts here', period: 'afternoon' },
  { text: 'A little daylight, a lot of possibility', period: 'afternoon' },
  { text: 'Make space for a surprising idea', period: 'afternoon' },
  { text: 'The afternoon is open for invention', period: 'afternoon' },
  { text: 'Evening, Harry. What shall we create?', period: 'evening' },
  { text: 'The evening has room for another idea', period: 'evening' },
  { text: 'What are you picturing tonight?', period: 'evening' },
  { text: 'The canvas is yours, Harry', period: 'evening' },
  { text: 'The day can end. The ideas can stay.', period: 'evening' },
  { text: 'An evening canvas, waiting', period: 'evening' },
  { text: "Let's make something worth lingering on", period: 'evening' },
  { text: 'Soft light, strong ideas', period: 'evening' },
  { text: 'A quiet evening for vivid thinking', period: 'evening' },
  { text: 'Let the next image unfold', period: 'evening' },
  { text: 'A late-night canvas, ready when you are', period: 'lateNight' },
  { text: 'A quiet hour for something vivid', period: 'night' },
  { text: 'The imagination stays bright after dark', period: 'night' },
  { text: 'Night shift, creative edition', period: 'night' },
  { text: 'Some ideas only arrive after dark', period: 'night' },
  { text: 'The quiet hours suit bold ideas', period: 'night' },
  { text: 'Late hours, vivid ideas', period: 'lateNight' },
  { text: "Let's follow that late-night thought", period: 'lateNight' },
  { text: 'After dark, imagination takes the lead', period: 'night' },
  { text: 'The world is quiet. The canvas is open.', period: 'night' },
  { text: 'Moonlight makes room for unusual ideas', period: 'night' },
  { text: 'Night settles in, ideas take shape', period: 'nightfall' },
];

export function selectCreateGreeting(now: Date, random: () => number = Math.random): string {
  const hour = now.getHours();
  const day = now.getDay();
  const matches = createGreetings.filter((greeting) => {
    const [start, end] = createGreetingPeriods[greeting.period];
    const matchesHour = start < end ? hour >= start && hour < end : hour >= start || hour < end;
    return matchesHour && (greeting.days === undefined || greeting.days.includes(day));
  });
  const greeting = matches[Math.floor(random() * matches.length)];
  if (greeting === undefined) throw new Error('No create greeting matches the current time');
  return greeting.text;
}
