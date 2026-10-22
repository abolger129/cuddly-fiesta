export type RoundStatus = 'upcoming' | 'submitting' | 'voting' | 'finished';

export type Group = {
  id: string;
  name: string;
  invite_code: string;
  created_by: string;
  total_rounds: number;
  created_at: string;
};
