function* zipTemplate(strings: TemplateStringsArray, pieces: Iterable<any>): Iterable<string> {
    const pIt = pieces[Symbol.iterator]();
    for (const string of strings.raw) {
        const piece = pIt.next().value ?? '';
        yield string + piece;
    }
}

function join(iterable: Iterable<string>, delimiter = ''): string {
    let result = '';
    for (const str of iterable) {
        if (str) {
            result += (result ? delimiter : '') + str;
        }
    }
    return result;
}

function* mapRegexContents(iterable: Iterable<any>): Iterable<string> {
    for (const value of iterable) {
        if (typeof value === 'undefined' || value === null) {
            yield '';
        } else if (value instanceof RegExp) {
            yield `(?:${value.source})`;
        } else if (Object.hasOwnProperty.call(value, 'or') && Array.isArray(value.or)) {
            let transformed = join(mapRegexContents(value.or), '|');
            yield transformed ? `(?:${transformed})` : '';
        } else if (typeof value !== 'object') {
            yield `(?:${value.toString().replace(/[\\/^$|()[\]{}.*+?]/g, '\\$&') ?? ''})`;
        } else {
            yield '';
        }
    }
}

export function reg(strings: TemplateStringsArray, ...pieces: any[]): RegExp {
  return new RegExp(join(zipTemplate(strings, mapRegexContents(pieces))));
}