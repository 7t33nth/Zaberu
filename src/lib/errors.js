export class SlotFullError extends Error {
  constructor() {
    super('slot_full');
    this.name = 'SlotFullError';
  }
}
