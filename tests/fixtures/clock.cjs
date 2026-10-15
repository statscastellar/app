// Rellotge exclusiu del procés de proves; cap canvi al codi de l'aplicació.
const NativeDate = Date;
const instant = NativeDate.parse('2030-01-15T12:00:00.000Z');
global.Date = class extends NativeDate {
  constructor(...args) { super(...(args.length ? args : [instant])); }
  static now() { return instant; }
};
