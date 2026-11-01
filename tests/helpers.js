export function zeros() {
  return [0, 1, 2, 3].map(() => ({ x: 0, y: 0, action: false, secondary: false }));
}

export function drive(index, input) {
  const all = zeros();
  all[index] = input;
  return all;
}

export const DUEL = [
  { kind: "human" },
  { kind: "human" },
  { kind: "off" },
  { kind: "off" },
];
