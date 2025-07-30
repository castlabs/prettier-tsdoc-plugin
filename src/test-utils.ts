import { TSDocParser } from '@microsoft/tsdoc';
import { createTSDocConfiguration } from './parser-config.js';
import { buildCommentModel as buildModel } from './models.js';

const configuration = createTSDocConfiguration();
const tsdocParser = new TSDocParser(configuration);

export function parse(comment: string) {
  return tsdocParser.parseString(comment);
}

export const buildCommentModel = buildModel;
