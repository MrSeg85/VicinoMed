/**
 * Specialty icon mapping (using Ionicons names)
 */
export const specialtyIcons: Record<string, string> = {
  cardiologia: 'heart',
  dermatologia: 'sunny',
  ginecologia: 'flower',
  ortopedia: 'body',
  oculistica: 'eye',
  odontoiatria: 'happy',
  pediatria: 'people',
  psicologia: 'sparkles',
  neurologia: 'pulse',
  endocrinologia: 'water',
  urologia: 'shield-checkmark',
  otorinolaringoiatria: 'ear',
};

export function specialtyIcon(id: string): string {
  return specialtyIcons[id] || 'medkit';
}

export function specialtyLabel(id: string): string {
  const map: Record<string, string> = {
    cardiologia: 'Cardiologia',
    dermatologia: 'Dermatologia',
    ginecologia: 'Ginecologia',
    ortopedia: 'Ortopedia',
    oculistica: 'Oculistica',
    odontoiatria: 'Odontoiatria',
    pediatria: 'Pediatria',
    psicologia: 'Psicologia',
    neurologia: 'Neurologia',
    endocrinologia: 'Endocrinologia',
    urologia: 'Urologia',
    otorinolaringoiatria: 'Otorinolaringoiatria',
  };
  return map[id] || id;
}
