import * as moo from 'moo';
import { reg } from './regexUtils';
import type { Rule, Token } from 'moo';

interface TokenInfo {
    text: string;
    lastToken: Token | null;
}

const createParenStack = (getLastToken: () => Token | null) => ({
    stack: [] as TokenInfo[],
    getLastToken,
    peek() {
        return this.stack[this.stack.length - 1] ?? null;
    },
    pop() {
        return this.stack.pop() ?? null;
    },
    push(text: string) {
        this.stack.push({ text, lastToken: this.getLastToken() });
    },
    isInsideParens(): boolean {
        const paren = this.peek();
        if (paren === null) return false;
        if (paren.text === '(' && paren.lastToken?.type !== 'TRY') return true;
        if (paren.text === '[' || paren.text === '?[') return true;
        return false;
    }
})

const __SKIP__ = '__SKIP__';
const SKIP = () => __SKIP__;
const LineTerminator = /\r?\n|\r/;
const Backslash = '\\';
const Slash = '/';
const Dollar = '$';
const GStringQuotationMark = '"';
const SqStringQuotationMark = "'";
const TdqStringQuotationMark = '"""';
const TsqStringQuotationMark = "'''";
const DollarSlashyGStringQuotationMarkBegin = '$/';
const DollarSlashyGStringQuotationMarkEnd = '/$';
const DollarSlashEscape = '$/';
const DollarDollarEscape = '$$';
const DollarSlashDollarEscape = '$/$';
const SlashEscape = reg`${Backslash}${Slash}`;
const DollarEscape = reg`${Backslash}${Dollar}`;

const Underscore = '_';
const Dot = '.';
const Underscores = reg`${Underscore}+`;

const IntegerTypeSuffix = /[lLiIgG]/;
const FloatTypeSuffix = /[fFdDgG]/;
const BinaryExponentIndicator = /[pP]/;
const Zero = '0';
const ZeroToThree = /[0-3]/;
const NonZeroDigit = /[1-9]/;
const Sign = /[+\-]/

const BinaryDigit = /[01]/;
const BinaryDigitOrUnderscore = reg`${BinaryDigit}|${Underscore}`;
const BinaryDigits = reg`${BinaryDigit}(?:${BinaryDigitOrUnderscore}*${BinaryDigit})?`;
const BinaryNumeral = reg`${Zero}[bB]${BinaryDigits}`;
const BinaryIntegerLiteral = reg`${BinaryNumeral}${IntegerTypeSuffix}?`;

const OctalDigit = /[0-7]/;
const OctalDigitOrUnderscore = reg`${OctalDigit}|${Underscore}`;
const OctalDigits = reg`${OctalDigit}(?:${OctalDigitOrUnderscore}*${OctalDigit})?`
const OctalNumeral = reg`${Zero}${Underscores}?${OctalDigits}`;
const OctalIntegerLiteral = reg`${OctalNumeral}${IntegerTypeSuffix}?`;

const Digit = reg`${Zero}|${NonZeroDigit}`;
const DigitOrUnderscore = reg`${Digit}|${Underscore}`;
const Digits = reg`${Digit}(?:${DigitOrUnderscore}*${Digit})?`;
const DecimalNumeral = reg`${{
    or: [
        Zero,
        reg`${NonZeroDigit}(?:${Digits}?|${Underscores}${Digits})`
    ]
}}`;
const DecimalIntegerLiteral = reg`${DecimalNumeral}${IntegerTypeSuffix}?`;

const SignedInteger = reg`${Sign}?${Digits}`;
const BinaryExponent = reg`${BinaryExponentIndicator}${SignedInteger}`;

const HexDigit = /[0-9a-fA-F]/;
const HexDigitOrUnderscore = reg`${HexDigit}|${Underscore}`;
const HexDigits = reg`${HexDigit}(?:${HexDigitOrUnderscore}*${HexDigit})?`
const HexNumeral = reg`${Zero}[xX]${HexDigits}`;
const HexIntegerLiteral = reg`${HexNumeral}${IntegerTypeSuffix}?`;
const HexSignificand = reg`${{
    or: [
        reg`${HexNumeral}${Dot}?`,
        reg`${Zero}[xX]${HexDigits}?${Dot}${HexDigits}`
    ]
}}`
const HexadecimalFloatingPointLiteral = reg`${HexSignificand}${BinaryExponent}${FloatTypeSuffix}?`;

const IntegerLiteral = reg`${{
    or: [
        HexIntegerLiteral,
        OctalIntegerLiteral,
        BinaryIntegerLiteral,
        DecimalIntegerLiteral
    ]
}}`;

const ExponentIndicator = /[eE]/;
const ExponentPart = reg`${ExponentIndicator}${SignedInteger}`;
const DecimalFloatingPointLiteral = reg`${{
    or: [
        reg`${Digits}?${Dot}${Digits}${ExponentPart}?${FloatTypeSuffix}?`,
        reg`${Digits}${ExponentPart}${FloatTypeSuffix}?`,
        reg`${Digits}${FloatTypeSuffix}`
    ]
}}`;
const FloatingPointLiteral = reg`${{
    or: [
        DecimalFloatingPointLiteral, 
        HexadecimalFloatingPointLiteral
    ]
}}`;

const UnicodeEscape = reg`${Backslash}u${HexDigit}${HexDigit}${HexDigit}${HexDigit}`;
const OctalEscape = reg`${{
    or: [
        reg`${Backslash}${ZeroToThree}${OctalDigit}${OctalDigit}`,
        reg`${Backslash}${OctalDigit}${OctalDigit}`,
        reg`${Backslash}${OctalDigit}`
    ]
}}`


const LineEscape = reg`${Backslash}${LineTerminator}`;
const EscapeSequence = reg`${{
    or: [
        LineEscape,
        DollarEscape,
        UnicodeEscape,
        OctalEscape,
        reg`${Backslash}[btnfrs"'\\]`
    ]
}}`;

const JavaLetter = /[a-zA-Z$_\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u00FF\u0100-\uFFFE]/;
const JavaLetterInGString = /[a-zA-Z_\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u00FF\u0100-\uFFFE]/;
const JavaLetterOrDigit = /[a-zA-Z0-9$_\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u00FF\u0100-\uFFFE]/;
const JavaLetterOrDigitInGString = /[a-zA-Z0-9_\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u00FF\u0100-\uFFFE]/;
const IdentifierInGString = reg`${JavaLetterInGString}${JavaLetterOrDigitInGString}*`;
const Identifier = reg`${JavaLetter}${JavaLetterOrDigit}*`;

const DqStringCharacter = reg`[^"\r\n\\$]|${EscapeSequence}`
const SqStringCharacter = reg`[^'\r\n\\]|${EscapeSequence}`;

const TdqStringCharacter = reg`${{
    or: [
        /[^"\\$]/,
        reg`${GStringQuotationMark}(?!"")`,
        reg`${GStringQuotationMark}(?="""(?!""))`,
        EscapeSequence,
        LineTerminator
    ]
}}`;
const TsqStringCharacter = reg`${{
    or: [
        /[^'\\]/,
        reg`${SqStringQuotationMark}(?!'')`,
        reg`${SqStringQuotationMark}(?='''(?!''))`,
        EscapeSequence,
        LineTerminator
    ]
}}`;
const SlashyStringCharacter = reg`${{
    or: [
        SlashEscape,
        reg`${Dollar}(?!${JavaLetterInGString})`,
        /[^/$\u0000]/
    ]
}}`;
const DollarSlashyStringCharacter = reg`${{
    or: [
        DollarDollarEscape,
        reg`(?<!\$)${DollarSlashDollarEscape}`,
        reg`${DollarSlashEscape}(?!\$)`,
        reg`${Slash}(?!\$)`,
        reg`${Dollar}(?!${JavaLetterInGString})`,
        /[^/$\u0000]/
    ]
}}`;

const SingleLineStringLiteral = reg`${{
    or: [
        reg`${GStringQuotationMark}${DqStringCharacter}*?${GStringQuotationMark}`,
        reg`${SqStringQuotationMark}${SqStringCharacter}*?${SqStringQuotationMark}`,
        reg`${DollarSlashyGStringQuotationMarkBegin}${DollarSlashyStringCharacter}+${DollarSlashyGStringQuotationMarkEnd}`
    ]
}}`;

const Whitespace = reg`(?:[ \t]+|${LineEscape}+)`;
const MultilineStringLiteral = reg`${{
    or: [
        reg`${TdqStringQuotationMark}${TdqStringCharacter}*?${TdqStringQuotationMark}`,
        reg`(?<=(?:^|[\^=+,.\-*<>\(|&~!%\[])${Whitespace}*)${Slash}(?!\*)${SlashyStringCharacter}+${Slash}`,
        reg`${TsqStringQuotationMark}${TsqStringCharacter}*?${TsqStringQuotationMark}`,
    ]
}}`;

const In = reg`in(?!${JavaLetterOrDigit})`;
const Instanceof = reg`instanceof(?!${JavaLetterOrDigit})`;
const Not = reg`!(?!${In}|${Instanceof}|=)`;

const Newline = reg`${LineTerminator}`;
const MultilineComment = /\/\*[^]*?\*\//;
const SingleLineComment = /\/\/[^\r\n\uFFFF]*/;
const ShCommand = /[^\r\n\uFFFF]*/;
const ShebangComment = reg`#!${ShCommand}(?:${LineTerminator}#!${ShCommand})*`;

export function createLexer() {
    let lastToken : Token | null = null;
    const parenStack = createParenStack(() => lastToken);

    function enterParen(text: string): string {
        parenStack.push(text);
        return text;
    }

    function exitParen(text: string): string {
        parenStack.pop();
        return text;
    }

    function ignoreTokenInsideParens(type: string | null = null): string | null {
        if (parenStack.isInsideParens()) {
            return __SKIP__;
        }
        return type;
    }
    const lexer = moo.states({
        DEFAULT_MODE: {  
            GStringBegin: [
                {
                    match: reg`${GStringQuotationMark}${DqStringCharacter}*?${Dollar}`,
                    value: s => {
                        lexer.pushState('DQ_GSTRING_MODE');
                        lexer.pushState('GSTRING_TYPE_SELECTOR_MODE');
                        return s;
                    }
                },
                {
                    match: reg`${TdqStringQuotationMark}${TdqStringCharacter}*?${Dollar}`,
                    value: s => {
                        lexer.pushState('TDQ_GSTRING_MODE');
                        lexer.pushState('GSTRING_TYPE_SELECTOR_MODE');
                        return s;
                    }
                },
                {
                    match: reg`${Slash}(?!\*)${SlashyStringCharacter}*?${Dollar}(?=${JavaLetterInGString})`,
                    value: s => {
                        lexer.pushState('SLASHY_GSTRING_MODE');
                        lexer.pushState('GSTRING_TYPE_SELECTOR_MODE');
                        return s;
                    }
                },
                { 
                    match: reg`${DollarSlashyGStringQuotationMarkBegin}${DollarSlashyStringCharacter}*?${Dollar}(?=${JavaLetterInGString})`, 
                    value: s => {
                        lexer.pushState('DOLLAR_SLASHY_GSTRING_MODE');
                        lexer.pushState('GSTRING_TYPE_SELECTOR_MODE');
                        return s;
                    }
                }
            ],
            StringLiteral: [
                { match: MultilineStringLiteral, lineBreaks: true },
                { match: SingleLineStringLiteral }
            ],
            FloatingPointLiteral,
            IntegerLiteral,
            RANGE_INCLUSIVE: /\.\.(?![<.])/,
            RANGE_EXCLUSIVE_LEFT: /<\.\.(?!<)/,
            RANGE_EXCLUSIVE_RIGHT: '..<',
            RANGE_EXCLUSIVE_FULL: '<..<',
            SPREAD_DOT: '*.',
            SAFE_DOT: '?.',
            SAFE_INDEX: { match: '?[', push: 'DEFAULT_MODE', value: enterParen },
            SAFE_CHAIN_DOT: '??.',
            ELVIS: '?:',
            METHOD_POINTER: '.&',
            METHOD_REFERENCE: '::',
            REGEX_FIND: '=~',
            REGEX_MATCH: '==~',
            POWER: /\*\*(?!=)/,
            POWER_ASSIGN: '**=',
            SPACESHIP: '<=>',
            IDENTICAL: '===',
            IMPLIES: '==>',
            NOT_IDENTICAL: '!==',
            ARROW: '->',
            NOT_INSTANCEOF: reg`!${Instanceof}`,
            NOT_IN: reg`!${In}`,
            LPAREN: { match: '(', push: 'DEFAULT_MODE', value: enterParen },
            RPAREN: { match: ')', pop: 1, value: exitParen },
            LBRACE: { match: '{', push: 'DEFAULT_MODE', value: enterParen },
            RBRACE: { match: '}', pop: 1, value: exitParen },
            LBRACK: { match: '[', push: 'DEFAULT_MODE', value: enterParen },
            RBRACK: { match: ']', pop: 1, value: exitParen },
            SEMI: ';',
            COMMA: ',',
            DOT: reg`${Dot}(?![.&])`,
            ASSIGN: /=(?![=~])/,
            GT: />(?!>{0,2}=)/,
            LT: /<(?!(?:\.\.)|=)/,
            NOT: Not,
            BITNOT: '~',
            QUESTION: /\?(?![=.:\[]|(?:\?\.))/,
            COLON: /:(?!:)/,
            EQUAL: /==(?![~=>])/,
            LE: /<=(?!>)/,
            GE: '>=',
            NOTEQUAL: /!=(?!=)/,
            AND: '&&',
            OR: '||',
            INC: '++',
            DEC: '--',
            ADD: /\+(?![+=])/,
            SUB: /-(?![\-=>])/,
            MUL: /\*(?![*=.])/,
            DIV: reg`${Slash}(?![=/*])`,
            BITAND: /&(?![&=])/,
            BITOR: /\|(?![|=])/,
            XOR: /\^(?!=)/,
            MOD: /%(?!=)/,
            ADD_ASSIGN: '+=',
            SUB_ASSIGN: '-=',
            MUL_ASSIGN: '*=',
            DIV_ASSIGN: '/=',
            AND_ASSIGN: '&=',
            OR_ASSIGN: '|=',
            XOR_ASSIGN: '^=',
            MOD_ASSIGN: '%=',
            LSHIFT_ASSIGN: '<<=',
            RSHIFT_ASSIGN: '>>=',
            URSHIFT_ASSIGN: '>>>=',
            ELVIS_ASSIGN: '?=',
            Identifier: { 
                match: Identifier, 
                type: (transform => 
                    s => s[0]?.toLowerCase() !== s[0] ? 'CapitalizedIdentifier' : transform(s)
                )(moo.keywords({
                    BooleanLiteral: [ 'true', 'false' ],
                    AS: 'as',
                    DEF: 'def',
                    IN: 'in',
                    TRAIT: 'trait',
                    THREADSAFE: 'threadsafe',
                    BuiltInPrimitiveType: [ 'boolean', 'char', 'byte', 'short', 'int', 'long', 'float', 'double' ],
                    NullLiteral: 'null',
                    ABSTRACT: 'abstract',
                    ASSERT: 'assert',
                    BREAK: 'break',
                    CASE: 'case',
                    CATCH: 'catch',
                    CLASS: 'class',
                    CONST: 'const',
                    CONTINUE: 'continue',
                    DEFAULT: 'default',
                    DO: 'do',
                    ELSE: 'else',
                    ENUM: 'enum',
                    EXTENDS: 'extends',
                    FINAL: 'final',
                    FINALLY: 'finally',
                    FOR: 'for',
                    IF: 'if',
                    GOTO: 'goto',
                    IMPLEMENTS: 'implements',
                    IMPORT: 'import',
                    INSTANCEOF: 'instanceof',
                    INTERFACE: 'interface',
                    NATIVE: 'native',
                    NEW: 'new',
                    NON_SEALED: 'non-sealed',
                    PACKAGE: 'package',
                    PERMITS: 'permits',
                    PRIVATE: 'private',
                    PROTECTED: 'protected',
                    PUBLIC: 'public',
                    RECORD: 'record',
                    RETURN: 'return',
                    SEALED: 'sealed',
                    STATIC: 'static',
                    STRICTFP: 'strictfp',
                    SUPER: 'super',
                    SWITCH: 'switch',
                    SYNCHRONIZED: 'synchronized',
                    THIS: 'this',
                    THROW: 'throw',
                    THROWS: 'throws',
                    TRANSIENT: 'transient',
                    TRY: 'try',
                    VAR: 'var',
                    VOID: 'void',
                    VOLATILE: 'volatile',
                    WHILE: 'while',
                    YIELD: 'yield'
                }))
            },
            AT_INTERFACE: reg`@interface(?!${JavaLetterOrDigit})`,
            AT: '@',
            ELLIPSIS: '...',
            WS: { match: Whitespace, type: SKIP },
            NL: { match: Newline, lineBreaks: true, type: () => ignoreTokenInsideParens() } as Rule,
            ML_COMMENT: [
                { match: reg`${MultilineComment}(?=[\s]*(?:${LineTerminator}|$))`, lineBreaks: true, type: () => ignoreTokenInsideParens('NL') } as Rule,
                { match: reg`${MultilineComment}(?![\s]*(?:${LineTerminator}|$))`, lineBreaks: true, type: SKIP }
            ],
            SL_COMMENT: { match: SingleLineComment, type: () => ignoreTokenInsideParens('NL') } as Rule,
            SH_COMMENT: { 
                match: ShebangComment, 
                lineBreaks: true, 
                type: () => {
                    if (!lastToken) return __SKIP__;
                    else throw new Error('Shebang comment should appear at the first line')
                } 
            },
            UNEXPECTED_CHAR: /./,
        },
        DQ_GSTRING_MODE: {
            GStringEnd: { match: reg`${DqStringCharacter}*?${GStringQuotationMark}`, pop: 1 },
            GStringPart: { match: reg`${DqStringCharacter}*?${Dollar}`, push: 'GSTRING_TYPE_SELECTOR_MODE' }
        },
        TDQ_GSTRING_MODE: {
            GStringEnd: { match: reg`${TdqStringCharacter}*?${TdqStringQuotationMark}`, pop: 1 },
            GStringPart: { match: reg`${TdqStringCharacter}*?${Dollar}`, push: 'GSTRING_TYPE_SELECTOR_MODE' }
        },
        SLASHY_GSTRING_MODE: {
            GStringEnd: { match: reg`${SlashyStringCharacter}*?${Dollar}?${Slash}`, pop: 1 },
            GStringPart: { match: reg`${SlashyStringCharacter}*?${Dollar}(?=${JavaLetterInGString})`, push: 'GSTRING_TYPE_SELECTOR_MODE' }
        },
        DOLLAR_SLASHY_GSTRING_MODE: {
            GStringEnd: { match: reg`${DollarSlashyStringCharacter}*?${DollarSlashyGStringQuotationMarkEnd}`, pop: 1 },
            GStringPart:  { match: reg`${DollarSlashyStringCharacter}*?${Dollar}(?=${JavaLetterInGString})`, push: 'GSTRING_TYPE_SELECTOR_MODE' }
        },
        GSTRING_TYPE_SELECTOR_MODE: {
            LBRACE: { 
                match: '{', 
                value: s => { 
                    lexer.popState(); 
                    lexer.pushState('DEFAULT_MODE'); 
                    return enterParen(s); 
                }
            },
            Identifier: [
                { 
                    match: reg`${IdentifierInGString}(?=${Dot}${IdentifierInGString})`, 
                    value: s => {
                        lexer.popState();
                        lexer.pushState('GSTRING_PATH_MODE');
                        return s;
                    }
                },
                { match: reg`${IdentifierInGString}(?!${Dot}${IdentifierInGString})`, pop: 1 }
            ]
        },
        GSTRING_PATH_MODE: {
            GStringPathPart: [
                { match: reg`${Dot}${IdentifierInGString}(?!${Dot}${IdentifierInGString})`, pop: 1 },
                { match: reg`${Dot}${IdentifierInGString}(?=${Dot}${IdentifierInGString})` }
            ]
        }
    });

    let done = false;
    lexer.next = (next => () => {
        let tok : Token | undefined;
        while ((tok = next.call(lexer)) && tok.type === __SKIP__) {}
        lastToken = tok ?? lastToken;
        const { buffer, line, col } = lexer as unknown as { buffer: string, line: number, col: number };

        if (!(tok || done)) {
            done = true;
            return {
                type: 'EOF',
                value: '',
                text: '',
                toString: () => '',
                offset: buffer.length,
                lineBreaks: 0,
                line: line,
                col:  col
            }
        } 
        return tok;
    })(lexer.next);
    
    return lexer;
}

const lexer = createLexer();
export default lexer;