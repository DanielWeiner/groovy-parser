import { SyntaxNode, isToken } from "./parseTree";

interface Span {
    offset: number;
    length: number;
}
function getOffset(node: SyntaxNode): number {
    return node.offset;
}

function getLength(node: SyntaxNode): number {
    if (isToken(node)) return node.text.length;
    return node.length;
}

export class ParseTreeSpanProvider {
    readonly #text: string
    constructor(text: string) {
        this.#text = text;
    }

    getSpan(nodes: SyntaxNode | SyntaxNode[] | null | undefined): Span | null {
        if (!nodes) return null;
        const leftmost = Array.isArray(nodes) ? nodes[0] : nodes;
        const rightmost = Array.isArray(nodes) ? nodes[nodes.length - 1] : nodes;
        if (!leftmost || !rightmost) return null;


        return {
            offset: getOffset(leftmost),
            length: getOffset(rightmost) + getLength(rightmost) - getOffset(leftmost)
        };
    }

    getText(offset: number, length: number): string {
        return this.#text.slice(offset, offset + length);
    }

    getNodeText(node: SyntaxNode | SyntaxNode[] | null | undefined): string {
        const span = this.getSpan(node);
        if (!span) return '';
        return this.getText(span.offset, span.length);
    }
}