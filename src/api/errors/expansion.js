module.exports = class Expansion {
  constructor() {
    this.type = `expansion`;

    /** @type {number} FileID */
    this.on = null;

    /** @type {{start: number, end: number}} */
    this.defined = {
      start: 0,
      end: 0,
    };

    /** @type {{start: number, end: number}} */
    this.range = {
      start: 0,
      end: 0,
    };
  }
}