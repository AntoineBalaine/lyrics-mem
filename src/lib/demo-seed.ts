import type { AddSongInput } from './db';

// Public-domain demo songs seeded into a fresh library so a first-time
// visitor sees something to interact with.
export const demoSongs: AddSongInput[] = [
  {
    artist: 'Traditional',
    title: 'Twinkle Twinkle Little Star',
    body: `Twinkle, twinkle, little star
How I wonder what you are
Up above the world so high
Like a diamond in the sky
Twinkle, twinkle, little star
How I wonder what you are
`,
    source: 'manual',
  },
  {
    artist: 'Sarah Josepha Hale',
    title: 'Mary Had a Little Lamb',
    body: `Mary had a little lamb
Its fleece was white as snow
And everywhere that Mary went
The lamb was sure to go

It followed her to school one day
Which was against the rules
It made the children laugh and play
To see a lamb at school
`,
    source: 'manual',
  },
  {
    artist: 'Traditional',
    title: 'Frère Jacques',
    body: `Frère Jacques, Frère Jacques
Dormez-vous, dormez-vous
Sonnez les matines, sonnez les matines
Ding ding dong, ding ding dong
`,
    source: 'manual',
  },
];
