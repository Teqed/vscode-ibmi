module.exports = class ILEError {
  constructor() {
    this.type = 'error';

    /** @type {number} */
    this.fileID = null;

    /** @type {number} */
    this.sev = null;
    /** @type {number} */
    this.linenum = null;

    /** @type {number} */
    this.column = 0;
    /** @type {number} */
    this.toColumn = 100;

    this.text = ``;
    this.code = ``
  }
}