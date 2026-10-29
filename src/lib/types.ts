export type RoundStatus = 'upcoming' | 'submitting' | 'voting' | 'finished';

export type Profile = {
  id: string;
  display_name: string;
  /** The player's hand-drawn avatar, as SVG path data on a 100 by 100 canvas. */
  avatar_doodle?: string | null;
};

export type Group = {
  id: string;
  name: string;
  invite_code: string;
  created_by: string;
  total_rounds: number;
  /** Max points: each voter's favourite gets N, counting down. null: every ranked song scores. */
  points_cap: number | null;
  /** Each voter's last-place song loses a point. */
  downvotes: boolean;
  /** Songs ranked below the max keep counting down into the negatives instead of getting 0. */
  negative_points: boolean;
  /** Hours to pick a song once a round opens. null means no timer. */
  submit_hours: number | null;
  /** Hours to rank once ranking starts. null means no timer. */
  vote_hours: number | null;
  /** Players can guess who picked each song for bonus points. */
  guessing_enabled: boolean;
  created_at: string;
  playlist_url: string | null;
  /** Artists nobody can pick in any round of this league. */
  banned_artists: string[];
  /** Minutes a round waits after a nudge before it can be nudged again. null: nudges are off. */
  nudge_cooldown_minutes: number | null;
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
  last_nudged_at: string | null;
  /** Artists nobody can pick in this round, on top of the league's. */
  banned_artists: string[];
};

export type Submission = {
  id: string;
  round_id: string;
  user_id: string;
  spotify_track_id: string | null;
  /** Set only for songs that aren't on Spotify. */
  youtube_url: string | null;
  track_name: string;
  artist_name: string;
  album_art_url: string | null;
  /** Spotify picks only, so a second song from the same album can be spotted. */
  spotify_album_id?: string | null;
  album_name?: string | null;
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

/** A player's idea for a future round's category. */
export type CategorySuggestion = {
  id: string;
  group_id: string;
  user_id: string;
  category: string;
  created_at: string;
};

export type RoundProgress = {
  member_count: number;
  submitted_count: number;
  /** Players who picked a song this round. Only they can rank. */
  voter_count: number;
  ranked_count: number;
  has_submitted: boolean;
  has_ranked: boolean;
};

/** What a song you're about to submit has in common with other players' picks. Never who picked them. */
export type SimilarPicks = {
  same_song: boolean;
  same_album: boolean;
  /** Artists on your song that someone else's song also credits, as your song names them. */
  same_artists: string[];
};
