export type RoundStatus = 'upcoming' | 'submitting' | 'voting' | 'finished';

export type Profile = {
  id: string;
  display_name: string;
};

export type Group = {
  id: string;
  name: string;
  invite_code: string;
  created_by: string;
  total_rounds: number;
  /** Only each voter's top N songs score. null: every ranked song scores. */
  points_cap: number | null;
  /** Each voter's last-place song loses a point. */
  downvotes: boolean;
  /** Hours to pick a song once a round opens. null means no timer. */
  submit_hours: number | null;
  /** Hours to rank once ranking starts. null means no timer. */
  vote_hours: number | null;
  /** Players can guess who picked each song for bonus points. */
  guessing_enabled: boolean;
  created_at: string;
};

export type Round = {
  id: string;
  group_id: string;
  round_number: number;
  category: string;
  status: RoundStatus;
  playlist_url: string | null;
  submit_deadline: string | null;
  vote_deadline: string | null;
};

export type Submission = {
  id: string;
  round_id: string;
  user_id: string;
  spotify_track_id: string | null;
  track_name: string;
  artist_name: string;
  album_art_url: string | null;
};

/** A song as shown for ranking: who picked it is hidden. */
export type RoundSong = Omit<Submission, 'round_id' | 'user_id'> & {
  is_mine: boolean;
};

export type Ranking = {
  round_id: string;
  voter_id: string;
  submission_id: string;
  position: number;
};

/** A guess at who picked a song. */
export type Guess = {
  round_id: string;
  guesser_id: string;
  submission_id: string;
  guessed_user_id: string;
};

/** A voter's comment on a song. Only your own are visible until the round is finished. */
export type SongComment = {
  round_id: string;
  submission_id: string;
  voter_id: string;
  body: string;
};

export type RoundProgress = {
  member_count: number;
  submitted_count: number;
  ranked_count: number;
  has_submitted: boolean;
  has_ranked: boolean;
};
