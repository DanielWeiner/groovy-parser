import type { Token } from 'moo';
export type { Token } from 'moo';


export interface Nonterminal {
    nodeType: 'nonterminal';
    kind: string;
    parts: SyntaxNode[];
    offset: number;
    length: number;
}

export interface Terminal {
    nodeType: 'terminal';
    kind: string;
    token: Token;
    offset: number;
    length: number;
}

export type AstNode = Terminal | Nonterminal
export type SyntaxNode = AstNode | Token
export type RawPostprocessorArgScalar = SyntaxNode | null | void | undefined;
export type RawPostprocessorArg = RawPostprocessorArgScalar | RawPostprocessorArg[] | Iterable<RawPostprocessorArg>;

export const isToken = (node: RawPostprocessorArgScalar): node is Token => !node || !('nodeType' in node);
export const isTerminal = (node: RawPostprocessorArgScalar): node is Terminal => !!node && !isToken(node) && node.nodeType === 'terminal';
export const isNonterminal = (node: RawPostprocessorArgScalar): node is Nonterminal => !!node && !isToken(node) && node.nodeType === 'nonterminal';
export function* concat(arg: RawPostprocessorArg): IterableIterator<SyntaxNode> {
    if (arg === null || arg === undefined) return;    
    if (!(Symbol.iterator in arg)) return yield arg;
    for (const value of arg) if (value) yield* concat(value);
}

function getNodeOfKind(node: AstNode, ...kinds: string[]): AstNode | null {
    return kinds.includes(node.kind) ? node : null;
}

export const getNodeOfKindLeftPosition = (node: RawPostprocessorArg, ...kinds: string[]): SyntaxNode | null => {
    if (!node) return null;
    if (Symbol.iterator in node) {
        for (const value of node) if (value) return getNodeOfKindLeftPosition(value, ...kinds);
        return null;
    }
    if (isToken(node)) return node;
    return (isNonterminal(node) && getNodeOfKindLeftPosition(node.parts, ...kinds)) 
        || getNodeOfKind(node, ...kinds);
}

export const getLeftmostToken = (node: RawPostprocessorArg): Token | null => {
    if (!node) return null;
    if (Symbol.iterator in node) {
        for (const value of node) if (value) return getLeftmostToken(value);
        return null;
    }
    if (isToken(node)) return node;
    if (isTerminal(node)) return node.token;
    if (isNonterminal(node)) return getLeftmostToken(node.parts);
    return null;
}

export const getNodeOfKindRightPosition = (node: RawPostprocessorArg, ...kinds: string[]): SyntaxNode | null => {
    if (!node) return null;
    if (Array.isArray(node)) {
        for (let i = node.length - 1; i >= 0; i--) {
            if (!node[i]) continue;
            return getNodeOfKindRightPosition(node[i], ...kinds);
        }
        return null;
    }
    if (Symbol.iterator in node) {
        let acc: RawPostprocessorArg;
        for (const value of node) acc = value;
        return getNodeOfKindRightPosition(acc, ...kinds);
    }
    if (isToken(node)) return node;
    if (kinds.length === 0) return node;
    return (isNonterminal(node) && getNodeOfKindRightPosition(node.parts, ...kinds)) || 
        getNodeOfKind(node, ...kinds);
}

export const getRightmostToken = (node: RawPostprocessorArg): Token | null => {
    if (!node) return null;
    if (Array.isArray(node)) {
        for (let i = node.length - 1; i >= 0; i--) {
            if (!node[i]) continue;
            return getRightmostToken(node[i]);
        }
        return null;
    }
    if (Symbol.iterator in node) {
        let acc: RawPostprocessorArg;
        for (const value of node) acc = value;
        return getRightmostToken(acc);
    }
    if (isToken(node)) return node;
    if (isTerminal(node)) return node.token;
    if (isNonterminal(node)) return getRightmostToken(node.parts);
    return null;
}