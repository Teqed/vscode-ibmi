const ILEError = require(`./error`);
const Expansion = require(`./expansion`);
const Line = require(`./line`);

module.exports = class FileID {
  constructor(fileID, parentID) {
    this.type = `file`;

    this.id = fileID;

    /** @type {number} */
    this.parent = parentID;

    /** @type {string} */
    this.path = null;

    /** @type {Array<FileID|Expansion|ILEError>} */
    this.declarations = [];

    /** @type {number} */
    this.startsAt = undefined;
    /** @type {number} */
    this.length = undefined;
  }
}