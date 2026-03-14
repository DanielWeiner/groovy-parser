@{% 
import lexer from './lexer';
import { AstNodeProvider, Postprocessor } from './astNodeProvider';
import { getNodeOfKindLeftPosition, getNodeOfKindRightPosition } from './ast';
const nil = () => null;

// There isn't an easy way to provide context to the parser, so a global variable will have to do
let astNodeProvider: AstNodeProvider | undefined;
export const setAstNodeProvider = (provider: AstNodeProvider) => { astNodeProvider = provider; } 
const getAstNodeProvider = () => astNodeProvider!

const nonterminal = AstNodeProvider.nonterminal(getAstNodeProvider);
const terminal = AstNodeProvider.terminal(getAstNodeProvider);

/*
* Rejects a new expression followed by a closure in a command chain, to avoid ambiguity with a new 
* expression followed by an anonymous inner class.
*/
const rejectInvalidNewCommandArg: Postprocessor = (data, loc, reject) => {
    const newExpr = getNodeOfKindLeftPosition(data, 'newExpression');
    if (!newExpr) return data;
    const closure = getNodeOfKindRightPosition(data, 'closure');
    if (closure) return reject;
    return data;
}
%}

@preprocessor typescript
@lexer lexer

main -> compilationUnit {% nonterminal('main') %}

kw[token] -> $token {% terminal('keyword') %}
punc[token] -> $token {% terminal('punctuation') %}
op[token] -> $token {% terminal('operator') %}
lit[token] -> $token {% terminal('literal') %}
ident[token] -> $token {% terminal('identifier') %}

asClosure[rule] -> $rule {% nonterminal('closure') %}
asBlock[rule] -> $rule {% nonterminal('block') %}
asBody[rule] -> $rule {% nonterminal('body') %}

anyOf2[a, b] -> $a $b | $a | $b
anyOf3[a, b, c] -> anyOf2[anyOf2[$a, $b], $c] 

statementTypeAssign[expr] -> variableNames nls op[%ASSIGN] nls statementExpression {% nonterminal('assignmentExpression') %}
                           | $expr nls assignOp nls enhancedStatementExpression {% nonterminal('assignmentExpression') %}

exprTypeAssign[ft] -> statementTypeAssign[$ft]
                    | $ft

exprTypeTern[type, ft] -> $ft nls punc[%QUESTION] nls $type nls punc[%COLON] nls $type {% nonterminal('ternaryExpression') %}
                        | $ft nls op[%ELVIS] nls $type {% nonterminal('elvisExpression') %}
                        | $ft

exprTypeImplies[type, ft] -> $ft nls op[%IMPLIES] nls $type {% nonterminal('impliesExpression') %}
                           | $ft

exprTypeOr[type, ft] -> $type nls op[%OR] nls $ft {% nonterminal('logicalOrExpression') %}
                      | $ft

exprTypeAnd[type, ft] -> $type nls op[%AND] nls $ft {% nonterminal('logicalAndExpression') %}
                       | $ft

exprTypeBitOr[type, ft] -> $type nls op[%BITOR] nls $ft {% nonterminal('bitwiseOrExpression') %}
                         | $ft

exprTypeBitXor[type, ft] -> $type nls op[%XOR] nls $ft {% nonterminal('exclusiveOrExpression') %}
                          | $ft

exprTypeBitAnd[type, ft] -> $type nls op[%BITAND] nls $ft {% nonterminal('bitwiseAndExpression') %}
                          | $ft

exprTypeRegex[type, ft] -> $type nls op[(%REGEX_FIND | %REGEX_MATCH)] nls $ft {% nonterminal('regexExpression') %}
                         | $ft

exprTypeEqu[type, ft] -> $type nls op[(%IDENTICAL | %NOT_IDENTICAL | %EQUAL | %NOTEQUAL | %SPACESHIP)] nls $ft {% nonterminal('equalityExpression') %}
                       | $ft

exprTypeRel[type, ft] -> $type nls op[%INSTANCEOF] nls matchingType {% nonterminal('typeExpression') %}
                       | $type nls op[(%AS | %NOT_INSTANCEOF)] nls type {% nonterminal('typeExpression') %}
                       | $type nls op[(%LE | %GE | %LT | %GT | %IN | %NOT_IN)] nls $ft {% nonterminal('booleanRelationalExpression') %}
                       | $ft 

exprTypeRangeShift[type, ft] -> $type nls shift nls $ft {% nonterminal('shiftExpression') %}
                              | $type nls range nls $ft {% nonterminal('rangeExpression') %}
                              | $ft

exprTypeAddSub[type, ft] -> $type op[(%ADD | %SUB)] nls $ft {% nonterminal('arithmeticExpression') %}
                          | $ft

exprTypeMulDivMod[type, ft] -> $type nls op[(%MUL | %DIV | %MOD)] nls $ft {% nonterminal('arithmeticExpression') %}
                             | $ft

exprTypeUnary[type, ft] -> op[(%INC | %DEC | %ADD | %SUB)] $type {% nonterminal('unaryExpression') %}
                         | $ft

exprTypePower[type, ft] -> $ft nls op[%POWER] nls $type {% nonterminal('powerExpression') %}
                         | $ft

exprTypeNegation[type, ft] -> op[(%BITNOT | %NOT)] nls $type {% nonterminal('negationExpression') %}
                            | $ft

exprTypeCast[postfix, ft] -> castParExpression castOperandExpression{% nonterminal('castExpression') %}
                           | $postfix
                           | switchExpression
                           | $ft

exprTypePostfix[path] -> $path op[(%INC | %DEC)] {% nonterminal('postfixExpression') %}
                       | $path

exprTypeNew[type, ft] -> kw[%NEW] nls createdName nls 

eof -> %EOF {% nil %}

compilationUnit -> nls (packageDeclaration sep):? scriptStatements eof
                 | nls (packageDeclaration sep:?):? eof

scriptStatements -> scriptStatement (sep scriptStatement):* sep:?

scriptStatement -> importDeclaration
                 | typeDeclaration
                 | annotationDeclaration
                 | outerMethodDeclaration
                 | statement

packageDeclaration -> annotations:? kw[%PACKAGE] (qualifiedName {% nonterminal('packageName') %}) {% nonterminal('packageDeclaration') %}

importDeclaration -> annotations:? kw[%IMPORT] kw[%STATIC]:? qualifiedName (punc[%DOT] punc[%MUL] | kw[%AS] identifier):? {% nonterminal('importDeclaration') %}

typeDeclaration -> classOrInterfaceModifiers:? classDeclaration {% nonterminal('typeDeclaration') %}

classBody -> punc[%LBRACE] nls classBodyDeclarations sep:? punc[%RBRACE] {% nonterminal('classBody') %}
           | punc[%LBRACE] sep:? punc[%RBRACE] {% nonterminal('classBody') %}

enumBody -> punc[%LBRACE] sep:? enumBodyContents sep:? punc[%RBRACE] {% nonterminal('enumBody') %}
          | punc[%LBRACE] sep:? punc[%RBRACE] {% nonterminal('enumBody') %}

annotationDeclarationBody -> punc[%LBRACE] nls annotationBodyDeclarations sep:? punc[%RBRACE]  {% nonterminal('annotationBody') %}
                           | punc[%LBRACE] sep:? punc[%RBRACE] {% nonterminal('annotationBody') %}
typeDeclarationBodyPrefix -> classDeclarationTypeParams classDeclarationFormalParams classDeclarationExtends classDeclarationImplements classDeclarationPermits

classDeclarationTail -> typeDeclarationBodyPrefix nls classBody
enumDeclarationTail -> typeDeclarationBodyPrefix nls enumBody

classDeclaration -> kw[(%CLASS | %INTERFACE | %TRAIT | %RECORD)] identifier classDeclarationTail
                  | kw[%ENUM] identifier enumDeclarationTail

annotationDeclaration -> classOrInterfaceModifiers:? kw[%AT_INTERFACE] identifier annotationDeclarationTail {% nonterminal('annotationDeclaration') %}

annotationDeclarationTail ->  classDeclarationTypeParams classDeclarationFormalParams classDeclarationExtends classDeclarationImplements classDeclarationPermits nls annotationDeclarationBody

classDeclarationTypeParams -> (nls typeParameters):?

classDeclarationFormalParams -> (nls formalParameters):?

classDeclarationExtends -> (nls kw[%EXTENDS] nls typeList):?

classDeclarationImplements -> (nls kw[%IMPLEMENTS] nls typeList):?

classDeclarationPermits -> (nls kw[%PERMITS] nls typeList):?

enumBodyContents -> enumConstants (sep classBodyDeclarations):?
                  | enumConstants nls punc[%COMMA] (sep classBodyDeclarations):?
                  | classBodyDeclarations

enumConstants -> enumConstant (punc[%COMMA] nls enumConstant):*

enumConstant -> annotations:? identifier arguments:? anonymousInnerClassDeclaration:?

classBodyDeclarations -> classBodyDeclaration (sep classBodyDeclaration):*

classBodyDeclaration -> kw[%STATIC] nls asBody[block]
                      | asBlock[block]
                      | memberDeclaration

annotationBodyDeclarations -> annotationMemberDeclaration (sep annotationMemberDeclaration):*

annotationMemberDeclaration -> fieldDeclaration
                             | annotationMethodDeclaration

memberDeclaration -> methodDeclaration
                   | fieldDeclaration
                   | annotationDeclaration
                   | modifiers:? (classDeclaration | compactConstructorDeclaration)

methodDeclaration -> modifiers:? typeParameters:? returnType:? methodName formalParameters methodDeclarationTail:? {% nonterminal('methodDeclaration') %}

outerMethodDeclaration -> anyOf3[modifiers, typeParameters, returnType] methodName formalParameters outerMethodDeclarationTail {% nonterminal('methodDeclaration') %}

annotationMethodDeclaration -> anyOf3[modifiers, typeParameters, returnType] methodName punc[%LPAREN] nls punc[%RPAREN] annotationMethodDeclarationTail:? {% nonterminal('methodDeclaration') %}

annotationMethodDeclarationTail -> nls kw[%DEFAULT] nls elementValue

outerMethodDeclarationTail -> (nls kw[%THROWS] nls qualifiedClassNameList):? nls methodBody

methodDeclarationTail -> nls kw[%THROWS] nls qualifiedClassNameList (nls methodBody):?
                       | nls methodBody

compactConstructorDeclaration -> methodName nls methodBody

methodName -> identifier
            | stringLiteral

returnType -> standardType
            | kw[%VOID]

fieldDeclaration -> variableDeclaration

modifiers -> modifier
           | modifiers nls modifier

modifier ->( classOrInterfaceModifier
           | kw[%NATIVE]
           | kw[%SYNCHRONIZED]
           | kw[%TRANSIENT]
           | kw[%VOLATILE]
           | kw[%DEF]
           | kw[%VAR]
           ) {% nonterminal('modifier') %}       

classOrInterfaceModifiers -> classOrInterfaceModifier (nls classOrInterfaceModifier):* nls

classOrInterfaceModifier -> annotation
                          | kw[%PUBLIC]
                          | kw[%PROTECTED]
                          | kw[%PRIVATE]
                          | kw[%STATIC]
                          | kw[%ABSTRACT]
                          | kw[%SEALED]
                          | kw[%NON_SEALED]
                          | kw[%FINAL]
                          | kw[%STRICTFP]
                          | kw[%DEFAULT]

variableModifiers -> variableModifier
                   | variableModifiers nls variableModifier

variableModifier -> annotation
                  | kw[%FINAL]
                  | kw[%DEF]
                  | kw[%VAR]
                  | kw[%PUBLIC]
                  | kw[%PROTECTED]
                  | kw[%PRIVATE]
                  | kw[%STATIC]
                  | kw[%ABSTRACT]
                  | kw[%STRICTFP]

typeParameters -> punc[%LT] nls typeParameter (punc[%COMMA] nls typeParameter):* nls punc[%GT]

typeParameter -> annotations:? className typeParameterBound:?

typeParameterBound -> kw[%EXTENDS] nls typeBound

typeBound -> type (op[%BITAND] nls type):*

typeList -> type (punc[%COMMA] nls type):*

type -> ( arrayType 
        | scalarType
        ) {% nonterminal('type') %}

ambiguousType -> ( ambiguousArrayType
                 | ambiguousScalarType
                 ) {% nonterminal('type') %}      

arrayType -> scalarType dim0:+  {% nonterminal('arrayType') %}

scalarType -> annotations:? typeCore {% nonterminal('scalarType') %}

ambiguousArrayType -> ambiguousScalarType dim0:+  {% nonterminal('arrayType') %}
ambiguousScalarType -> ambiguousTypeCore {% nonterminal('scalarType') %}

unambiguousType -> annotations typeCore dim0:*
                 | unambiguousReferenceType dim0:*

typeCore -> kw[%VOID]
          | primitiveType
          | referenceType

ambiguousTypeCore -> kw[%VOID]
                   | primitiveType
                   | ambiguousReferenceType

referenceType -> qualifiedClassName typeArguments:?

unambiguousReferenceType -> qualifiedClassName typeArguments

ambiguousReferenceType -> qualifiedClassName

primitiveType -> %BuiltInPrimitiveType {% terminal('primitiveType') %}

standardType -> annotations:? standardTypeCore dim0:*

standardTypeCore -> primitiveType
                  | standardClassOrInterfaceType

standardClassOrInterfaceType -> qualifiedStandardClassName typeArguments:?

matchingType -> standardType identifier:?

typeArguments -> punc[%LT] nls typeArgument typeArgumentList nls punc[%GT]

typeArgumentList -> (punc[%COMMA] nls typeArgument):*

typeArgument -> type
              | annotations:? punc[%QUESTION] typeArgumentBound

typeArgumentBound -> (kw[(%EXTENDS | %SUPER)] nls type):?

dim0 -> annotations:? punc[%LBRACK] punc[%RBRACK]

dim1 -> annotations:? punc[%LBRACK] expression punc[%RBRACK]

nonWildcardTypeArguments -> punc[%LT] nls typeList nls punc[%GT]

typeArgumentsOrDiamond -> punc[%LT] punc[%GT]
                        | typeArguments

qualifiedName -> qualifiedNameElement (punc[%DOT] qualifiedNameElement):*

qualifiedNameElement -> identifier
                      | kw[%DEF]
                      | kw[%IN]
                      | kw[%AS]
                      | kw[%TRAIT]

qualifiedNameElements -> (qualifiedNameElement punc[%DOT]):*

qualifiedClassName -> qualifiedNameElements identifier

qualifiedStandardClassName -> qualifiedNameElements className (punc[%DOT] className):*

annotatedQualifiedClassName -> annotations:? qualifiedClassName

qualifiedClassNameList -> annotatedQualifiedClassName (punc[%COMMA] nls annotatedQualifiedClassName):*

annotations -> annotation (nls annotation):* nls

annotation -> punc[%AT] annotationName (nls punc[%LPAREN] elementValues:? punc[%RPAREN]):? {% nonterminal('annotation') %}

annotationName -> qualifiedClassName

elementValues -> elementValuePairs {% nonterminal('elementValuePairs') %}
               | elementValue {% nonterminal('elementValue') %}

elementValuePairs -> elementValuePair (punc[%COMMA] elementValuePair):*

elementValuePair -> elementValuePairName nls op[%ASSIGN] nls elementValue

elementValuePairName -> identifier
                      | keywords

elementValue -> annotationExpression

elementValueArrayInitializer -> punc[%LBRACK] elementValueItems punc[%RBRACK] 
                              | punc[%LBRACE] (elementValue punc[%COMMA]):+ punc[%COMMA] elementValue:? punc[%RBRACE]

elementValueItems -> (elementValue (punc[%COMMA] elementValue):* punc[%COMMA]:?):?

formalParameters -> punc[%LPAREN] formalParameterList:? punc[%RPAREN] {% nonterminal('formalParameters') %}

formalParameterList -> (formalParameter | thisFormalParameter) (punc[%COMMA] nls formalParameter):*

thisFormalParameter -> type kw[%THIS]

formalParameter -> variableModifiers:? type:? ellipsis:? variableDeclaratorId formalParameterDefault:? {% nonterminal('formalParameter') %}

ellipsis -> punc[%ELLIPSIS]

formalParameterDefault -> nls op[%ASSIGN] nls expression {% nonterminal('formalParameterDefault') %}

                     
anyVariableDeclaration -> modifiers nls type:? variableDeclarators
                        | modifiers nls typeNamePairs nls op[%ASSIGN] nls variableInitializer

variableDeclaration -> anyVariableDeclaration
                     | type variableDeclarators 

localVariableDeclaration ->( anyVariableDeclaration
                           | unambiguousType variableDeclarators
                           | ambiguousType nls variableDeclaratorsAssign
                           ){% nonterminal('localVariableDeclaration') %}

variableDeclarators -> variableDeclarator (punc[%COMMA] nls variableDeclarator):* {% nonterminal('variableDeclarators') %}
variableDeclaratorsAssign -> (variableDeclarator (punc[%COMMA] nls variableDeclarator):* punc[%COMMA] nls):? variableDeclaratorAssign {% nonterminal('variableDeclarators') %}

variableDeclarator -> variableDeclaratorId (nls op[%ASSIGN] nls variableInitializer):? {% nonterminal('variableDeclarator') %}
variableDeclaratorAssign -> variableDeclaratorId nls op[%ASSIGN] nls variableInitializer {% nonterminal('variableDeclarator') %}

variableDeclaratorId -> identifier

variableInitializer -> enhancedStatementExpression {% nonterminal('variableInitializer') %}

typeNamePairs -> punc[%LPAREN] typeNamePair (punc[%COMMA] typeNamePair):* punc[%RPAREN]

typeNamePair -> type:? variableDeclaratorId

variableNames -> punc[%LPAREN] variableDeclaratorId (punc[%COMMA] variableDeclaratorId):+ punc[%RPAREN] {% nonterminal('variableNames') %}

block -> punc[%LBRACE] sep:? blockStatements:? punc[%RBRACE]

methodBody -> asBody[block]

blockStatements -> blockStatement (sep blockStatement):* sep:?

blockStatement -> statement

assignStatement -> statementTypeAssign[exprTern]
                 
statement -> ( conditionalStatement
             | loopStatement
             | tryCatchStatement
             | kw[%SYNCHRONIZED] expressionInPar nls asBlock[block] {% nonterminal('synchronizedStatement') %}
             | kw[%RETURN] expression {% nonterminal('returnStatement') %}
             | kw[%RETURN] {% nonterminal('returnStatement') %}
             | kw[%THROW] expression {% nonterminal('throwStatement') %}
             | breakStatement
             | continueStatement
             | yieldStatement
             | identifier punc[%COLON] nls statement {% nonterminal('labeledStatement') %}
             | assertStatement
             | localVariableDeclaration
             | statementExpression
             | assignStatement
             ) {% nonterminal('statement') %}

conditionalStatement -> ifElseStatement

ifElseStatement -> kw[%IF] expressionInPar nls statement (sep:? kw[%ELSE] nls statement):? {% nonterminal('ifElse') %}

loopStatement -> kw[%FOR] punc[%LPAREN] forControl punc[%RPAREN] nls statement {% nonterminal('forLoop')  %}
               | kw[%WHILE] expressionInPar nls statement {% nonterminal('whileLoop') %}
               | kw[%DO] nls statement nls kw[%WHILE] expressionInPar {% nonterminal('doWhileLoop') %}

continueStatement -> kw[%CONTINUE] identifier:? {% nonterminal('continueStatement') %}

breakStatement -> kw[%BREAK] identifier:? {% nonterminal('breakStatement') %}

yieldStatement -> kw[%YIELD] expression {% nonterminal('yieldStatement') %}

tryCatchStatement -> kw[%TRY] resources:? nls asBlock[block] (nls catchClause):* finallyBlock:? {% nonterminal('tryCatch') %}

resources -> punc[%LPAREN] nls resourceList sep:? punc[%RPAREN]

resourceList -> resource (sep resource):*

resource -> localVariableDeclaration
          | expression

catchClause -> kw[%CATCH] catchArgs nls asBlock[block] {% nonterminal('catch') %}

catchArgs -> punc[%LPAREN] variableModifiers:? catchType:? identifier punc[%RPAREN] {% nonterminal('catchArgument') %}

catchType -> qualifiedClassName (op[%BITOR] qualifiedClassName):*

finallyBlock -> kw[%FINALLY] nls asBlock[block] {% nonterminal('finally') %}

assertStatement -> kw[%ASSERT] expression (nls punc[(%COLON | %COMMA)] nls expression):? {% nonterminal('assertStatement') %}

forControl -> enhancedForControl
            | originalForControl

enhancedForControl -> (indexVariable punc[%COMMA]):? variableModifiers:? type:? identifier punc[(%COLON | %IN)] expression

indexVariable -> ident[(%BuiltInPrimitiveType | %DEF | %VAR)]:? identifier

originalForControl -> forInit:? punc[%SEMI] expression:? punc[%SEMI] forUpdate:?

forInit -> localVariableDeclaration
         | expressionList_noSpread

forUpdate -> expressionList_noSpread

expressionList_noSpread -> expression (punc[%COMMA] nls expression):*

switchExpression -> kw[%SWITCH] expressionInPar nls punc[%LBRACE] nls switchBlockStatementExpressionGroup:* punc[%RBRACE] {% nonterminal('switchExpr') %}

switchBlockStatementExpressionGroup -> switchExpressionLabelList blockStatements

switchExpressionLabelList -> (switchExpressionLabel nls):+

switchExpressionLabel -> (kw[%CASE] expressionList_spread | kw[%DEFAULT]) punc[(%ARROW|%COLON)]

expressionList_spread -> expressionListElement_spread (punc[%COMMA] nls expressionListElement_spread):*

expressionListElement_spread -> punc[%MUL]:? expression

statementExpression -> commandExpression
                     | closure
                     
enhancedStatementExpression -> statementExpression
                             | standardLambdaExpression

enhancedExpression -> expression
                    | standardLambdaExpression

expression -> exprAssign

annotationExpression -> annExprTern
cmdExpression -> cmdExprTern

cmdFirstArgExpression -> cmdFirstArgExprTern

exprAssign -> exprTypeAssign[exprTern]
cmdExprAssign -> exprTypeAssign[cmdExprTern]

exprTern -> exprTypeTern[exprTern, exprImplies]
annExprTern -> exprTypeTern[annExprTern, annExprImplies]
cmdExprTern -> exprTypeTern[cmdExprTern, cmdExprImplies]
cmdFirstArgExprTern -> exprTypeTern[cmdFirstArgExprTern, cmdFirstArgExprImplies]

exprImplies -> exprTypeImplies[exprImplies, exprOr]
annExprImplies -> exprTypeImplies[annExprImplies, annExprOr]
cmdExprImplies -> exprTypeImplies[cmdExprImplies, cmdExprOr]
cmdFirstArgExprImplies -> exprTypeImplies[cmdFirstArgExprImplies, cmdFirstArgExprOr]

exprOr -> exprTypeOr[exprOr, exprAnd]
annExprOr -> exprTypeOr[annExprOr, annExprAnd]
cmdExprOr -> exprTypeOr[cmdExprOr, cmdExprAnd]
cmdFirstArgExprOr -> exprTypeOr[cmdFirstArgExprOr, cmdFirstArgExprAnd]

exprAnd -> exprTypeAnd[exprAnd, exprBitOr]
annExprAnd -> exprTypeAnd[annExprAnd, annExprBitOr]
cmdExprAnd -> exprTypeAnd[cmdExprAnd, cmdExprBitOr]
cmdFirstArgExprAnd -> exprTypeAnd[cmdFirstArgExprAnd, cmdFirstArgExprBitOr]

exprBitOr -> exprTypeBitOr[exprBitOr, exprBitXor]
annExprBitOr -> exprTypeBitOr[annExprBitOr, annExprBitXor]
cmdExprBitOr -> exprTypeBitOr[cmdExprBitOr, cmdExprBitXor]
cmdFirstArgExprBitOr -> exprTypeBitOr[cmdFirstArgExprBitOr, cmdFirstArgExprBitXor]

exprBitXor -> exprTypeBitXor[exprBitXor, exprBitAnd]
annExprBitXor -> exprTypeBitXor[annExprBitXor, annExprBitAnd]
cmdExprBitXor -> exprTypeBitXor[cmdExprBitXor, cmdExprBitAnd]
cmdFirstArgExprBitXor -> exprTypeBitXor[cmdFirstArgExprBitXor, cmdFirstArgExprBitAnd]

exprBitAnd -> exprTypeBitAnd[exprBitAnd, exprRegex]
annExprBitAnd -> exprTypeBitAnd[annExprBitAnd, annExprRegex]
cmdExprBitAnd -> exprTypeBitAnd[cmdExprBitAnd, cmdExprRegex]
cmdFirstArgExprBitAnd -> exprTypeBitAnd[cmdFirstArgExprBitAnd, cmdFirstArgExprRegex]

exprRegex -> exprTypeRegex[exprRegex, exprEqu]
annExprRegex -> exprTypeRegex[annExprRegex, annExprEqu]
cmdExprRegex -> exprTypeRegex[cmdExprRegex, cmdExprEqu]
cmdFirstArgExprRegex -> exprTypeRegex[cmdFirstArgExprRegex, cmdFirstArgExprEqu]

exprEqu -> exprTypeEqu[exprEqu, exprRel]
annExprEqu -> exprTypeEqu[annExprEqu, annExprRel]
cmdExprEqu -> exprTypeEqu[cmdExprEqu, cmdExprRel]
cmdFirstArgExprEqu -> exprTypeEqu[cmdFirstArgExprEqu, cmdFirstArgExprRel]

exprRel -> exprTypeRel[exprRel, exprRangeShift]
annExprRel -> exprTypeRel[annExprRel, annExprRangeShift]
cmdExprRel -> exprTypeRel[cmdExprRel, cmdExprRangeShift]
cmdFirstArgExprRel -> exprTypeRel[cmdFirstArgExprRel, cmdFirstArgExprRangeShift]

exprRangeShift -> exprTypeRangeShift[exprRangeShift, exprAddSub]
annExprRangeShift -> exprTypeRangeShift[annExprRangeShift, annExprAddSub]
cmdExprRangeShift -> exprTypeRangeShift[cmdExprRangeShift, cmdExprAddSub]
cmdFirstArgExprRangeShift -> exprTypeRangeShift[cmdFirstArgExprRangeShift, cmdFirstArgExprAddSub]

exprAddSub -> exprTypeAddSub[exprAddSub, exprMulDivMod]
annExprAddSub -> exprTypeAddSub[annExprAddSub, annExprMulDivMod]
cmdExprAddSub -> exprTypeAddSub[cmdExprAddSub, cmdExprMulDivMod]
cmdFirstArgExprAddSub -> exprTypeAddSub[cmdFirstArgExprAddSub, cmdFirstArgExprMulDivMod]

exprMulDivMod -> exprTypeMulDivMod[exprMulDivMod, exprUnary]
annExprMulDivMod -> exprTypeMulDivMod[annExprMulDivMod, annExprUnary]
cmdExprMulDivMod -> exprTypeMulDivMod[cmdExprMulDivMod, cmdExprUnary]
cmdFirstArgExprMulDivMod -> exprTypeMulDivMod[cmdFirstArgExprMulDivMod, cmdFirstArgExprUnary]

exprUnary-> exprTypeUnary[exprUnary, exprPower]
annExprUnary -> exprTypeUnary[annExprUnary, annExprPower]
cmdExprUnary -> exprTypeUnary[cmdExprUnary, cmdExprPower]

cmdFirstArgExprUnary -> op[(%INC | %DEC)] cmdFirstArgExprUnary {% nonterminal('unaryExpression') %}
                      | cmdFirstArgExprPower

exprPower -> exprTypePower[exprPower, exprNegation]
annExprPower -> exprTypePower[annExprPower, annExprNegation]
cmdExprPower -> exprTypePower[cmdExprPower, cmdExprNegation]
cmdFirstArgExprPower -> exprTypePower[cmdFirstArgExprPower, cmdFirstArgExprNegation]

exprNegation -> exprTypeNegation[exprNegation, exprCast]
annExprNegation -> exprTypeNegation[annExprNegation, annExprCast]
cmdExprNegation -> exprTypeNegation[cmdExprNegation, cmdExprCast]
cmdFirstArgExprNegation -> exprTypeNegation[cmdFirstArgExprNegation, cmdFirstArgExprCast]

castOperandExpression -> castParExpression castOperandExpression
                       | postfixExpression
                       | parExpression
                       | op[(%BITNOT|%NOT)] nls castOperandExpression {% nonterminal('negationExpression') %}
                       | op[(%INC | %DEC | %ADD | %SUB)] castOperandExpression {% nonterminal('unaryExpression') %}

exprCast -> exprTypeCast[postfixExpression, exprAtom]
annExprCast -> exprTypeCast[postfixExpression, annExprAtom]
cmdExprCast -> exprTypeCast[postfixExpression, cmdExprAtom]
cmdFirstArgExprCast -> exprTypeCast[cmdFirstArgPostfixExpression, cmdFirstArgExprAtom]

postfixExpression -> exprTypePostfix[pathExpression]
cmdFirstArgPostfixExpression -> exprTypePostfix[cmdFirstArgPathExpression]

castParExpression -> punc[%LPAREN] type punc[%RPAREN] {% nonterminal('castType') %}
exprAtom -> atom
annExprAtom -> annAtom
cmdExprAtom -> cmdAtom

cmdFirstArgExprAtom -> cmdFirstArgAtom

atom -> kw[%THIS] {% nonterminal('thisExpression') %}
      | kw[%SUPER] {% nonterminal('superExpression') %}
      | parExpression 
      | newExpression
      | lambdaExpression
      | list
      | map

annAtom -> parExpression
         | elementValueArrayInitializer
         | newExpression
         | closure
         | annotation
         | map

cmdAtom -> kw[%THIS] {% nonterminal('thisExpression') %}
         | kw[%SUPER] {% nonterminal('superExpression') %}
         | newExpression
         | parExpression
         | list
         | map

cmdFirstArgAtom -> kw[%THIS] {% nonterminal('thisExpression') %}
                 | kw[%SUPER] {% nonterminal('superExpression') %}
                 | newExpression
                 | map

commandArgumentList -> argumentList {% nonterminal('commandArgumentList') %}

commandExpression -> cmdExpression (commandArguments commandPathExpressionTail:?):? {% nonterminal('commandExpression', rejectInvalidNewCommandArg) %}
commandExpressionTail -> commandArguments commandPathExpressionTail:?
commandPathExpressionTail -> cmdPathExpression commandArguments commandPathExpressionTail:?
                           | cmdPathExpressionArguments commandPathExpressionTail:? 
                           | cmdPathExpression

commandArguments -> cmdArgumentList {% nonterminal('commandArguments') %}

cmdArgumentList -> cmdFirstArgumentListElement (punc[%COMMA] nls cmdArgumentListTail):? {% nonterminal('commandArgumentList') %}

cmdArgumentListTail -> nls closureOrLambdaExpression punc[%COMMA] cmdArgumentListTail
                     | arguments punc[%COMMA] cmdArgumentListTail
                     | cmdArgumentListElement (punc[%COMMA] nls cmdArgumentListElement):*

cmdFirstArgumentListElement -> cmdFirstArgExpression
                             | namedArg

primary ->( identifier
          | builtInType
          | literal
          | gstring
          ) {% nonterminal('primary') %}

commandPrimary -> identifier
                | literal
                | gstring 

cmdFirstArgPrimary -> identifier
                    | literal
                    | gstring

namedArgPrimary -> identifier
                 | literal
                 | gstring

namedPropertyArgPrimary -> identifier
                         | literal
                         | gstring
                         | parExpression
                         | list
                         | map

pathExpression -> primary pathElement:*              {% nonterminal('pathExpression') %}
                | (atom | kw[%STATIC]) pathElement:+ {% nonterminal('pathExpression') %}   

cmdPathExpression -> commandPrimary noArgumentPathElements:? {% nonterminal('commandPathExpression') %}
                   | (cmdAtom | kw[%STATIC]) noArgumentPathElements {% nonterminal('commandPathExpression') %}

cmdFirstArgPathExpression -> cmdFirstArgPrimary pathElement:* {% nonterminal('commandPathExpression') %}
                           | (cmdFirstArgAtom | kw[%STATIC]) pathElement:+ {% nonterminal('commandPathExpression') %}

cmdPathExpressionArguments -> commandPrimary argumentPathElements {% nonterminal('commandPathExpression') %}
                            | (cmdAtom | kw[%STATIC]) argumentPathElements {% nonterminal('commandPathExpression') %}

noArgumentPathElement -> nls dotOp nls punc[%AT]:? nonWildcardTypeArguments:? namePart
                       | nls op[%METHOD_POINTER] nls namePart
                       | nls punc[%DOT] newExpression
                       | nls op[%METHOD_REFERENCE] nls nonWildcardTypeArguments:? namePart
                       | indexPropertyArgs
                       | namedPropertyArgs

argumentPathElement -> nls punc[%DOT] nls newExpression
                     | nls closureOrLambdaExpression
                     | arguments

nonClosureArgumentPathElement -> nls punc[%DOT] nls newExpression
                               | nls lambdaExpression
                               | arguments

pathElement -> noArgumentPathElement
             | argumentPathElement

noArgumentPathElements -> pathElement:* noArgumentPathElement
argumentPathElements -> pathElement:* argumentPathElement

namePart ->( identifier
           | stringLiteral
           | dynamicMemberName
           | keywords
           ) {% nonterminal('namePart') %}

dynamicMemberName -> parExpression
                   | gstring

indexPropertyArgs -> punc[(%SAFE_INDEX| %LBRACK)] expressionList_spread:? punc[%RBRACK] {% nonterminal('indexPropertyArgs') %}

namedPropertyArgs -> punc[(%SAFE_INDEX | %LBRACK)] (namedPropertyArgList | punc[%COLON]) punc[%RBRACK] {% nonterminal('namedPropertyArgs') %}

parExpression -> expressionInPar {% nonterminal('parExpression') %}

expressionInPar -> punc[%LPAREN] enhancedStatementExpression punc[%RPAREN]

list -> punc[%LBRACK] expressionList_spread:? punc[%COMMA]:? punc[%RBRACK] {% nonterminal('list') %}

map -> punc[%LBRACK] mapEntryList punc[%COMMA]:? punc[%RBRACK] {% nonterminal('map') %}
     | punc[%LBRACK] punc[%COLON] punc[%RBRACK] {% nonterminal('emptyMap') %}

mapEntryList -> mapEntry (punc[%COMMA] mapEntry):*

mapEntry -> mapEntryLabel punc[%COLON] nls enhancedExpression {% nonterminal('mapEntry') %}
          | op[%MUL] punc[%COLON] nls enhancedExpression {% nonterminal('mapEntry') %}

mapEntryLabel -> keywords
               | primary

namedPropertyArgList -> namedPropertyArg (punc[%COMMA] namedPropertyArg):*

namedPropertyArg -> (namedPropertyArgLabel | punc[%MUL]) punc[%COLON] nls enhancedExpression

namedPropertyArgLabel -> keywords
                       | namedPropertyArgPrimary

namedArg -> (namedArgLabel | punc[%MUL]) punc[%COLON] nls enhancedExpression

namedArgLabel -> keywords
               | namedArgPrimary

newExpression -> ( newExpressionArguments
                 | newExpressionNoArguments
                 ) {% nonterminal('newExpression') %}

newExpressionArguments -> new creatorArguments
newExpressionNoArguments -> new creatorNoArguments

creator -> createdName creatorSuffix {% nonterminal('creator') %}
creatorNoArguments -> createdName createdSuffixArrayInit {% nonterminal('creator') %}

creatorArguments -> createdName creatorSuffixArguments
                  | createdName creatorSuffixInnerClass

creatorSuffix -> creatorSuffixArguments
               | creatorSuffixInnerClass
               | createdSuffixArrayInit

creatorSuffixArguments -> nls arguments

creatorSuffixInnerClass -> nls arguments nls anonymousInnerClassDeclaration

createdSuffixArrayInit -> dim1:+ dim0:* nls arrayInitializer {% nonterminal('creatorSuffix') %}
                        | dim0:+ nls arrayInitializer {% nonterminal('creatorSuffix') %}

anonymousInnerClassDeclaration -> classBody

createdName -> annotations:? createdNameCore

createdNameCore -> primitiveType
                 | qualifiedClassName typeArgumentsOrDiamond:?

arrayInitializer -> punc[%LBRACE] nls arrayInitializerElements:? punc[%COMMA]:? nls punc[%RBRACE] {% nonterminal('arrayInitializer') %}

arrayInitializerElements -> arrayInitializerElement nls (punc[%COMMA] nls arrayInitializerElement nls):*

arrayInitializerElement -> arrayInitializer
                         | variableInitializer

arguments -> punc[%LPAREN] enhancedArgumentListInPar:? punc[%COMMA]:? punc[%RPAREN] {% nonterminal('arguments') %}

enhancedArgumentListInPar -> enhancedArgumentListElement (punc[%COMMA] nls enhancedArgumentListElement):*

enhancedArgumentListElement -> expressionListElement_spread
                             | standardLambdaExpression
                             | namedPropertyArg {% nonterminal('enhancedArgumentListElement') %}

argumentList -> firstArgumentListElement (punc[%COMMA] nls argumentListElement):*

firstArgumentListElement -> expressionListElement_spread
                          | namedArg {% nonterminal('firstAgumentListElement') %}

cmdArgumentListElement -> punc[%MUL]:? cmdExpression {% nonterminal('cmdArgumentListElement') %}
                        | namedPropertyArg {% nonterminal('cmdArgumentListElement') %}

argumentListElement -> expressionListElement_spread
                     | namedPropertyArg {% nonterminal('argumentListElement') %}

lambdaExpression -> formalParameters nls op[%ARROW] nls lambdaBody

standardLambdaExpression -> formalParameters nls op[%ARROW] nls lambdaBody
                          | variableDeclaratorId nls op[%ARROW] nls lambdaBody

lambdaBody -> asBody[block]
            | statementExpression

closure -> closureWithParams
         | asClosure[block]

closureWithParams -> punc[%LBRACE] nls (formalParameterList nls):? op[%ARROW] sep:? blockStatements:? punc[%RBRACE] {% nonterminal('closure') %}

closureOrLambdaExpression -> closureWithParams
                           | asClosure[block]
                           | lambdaExpression

gstring -> lit[%GStringBegin] gstringValueList lit[%GStringEnd]

gstringValueList -> gstringValue
                  | gstringValueList lit[%GStringPart] gstringValue

gstringValue -> gstringPath
              | closure

gstringPath -> identifier ident[%GStringPathPart]:*

literal -> lit[%IntegerLiteral]
         | lit[%FloatingPointLiteral]
         | stringLiteral
         | lit[%BooleanLiteral]
         | lit[%NullLiteral]

stringLiteral -> lit[%StringLiteral]

className -> ident[%CapitalizedIdentifier]

identifier -> ident[%Identifier]
            | ident[%CapitalizedIdentifier]
            | ident[%AS]
            | ident[%IN]
            | ident[%PERMITS]
            | ident[%RECORD]
            | ident[%SEALED]
            | ident[%TRAIT]
            | ident[%VAR]
            | ident[%YIELD]

builtInType -> kw[%BuiltInPrimitiveType]
             | kw[%VOID]

keywords -> kw[%ABSTRACT]
          | kw[%AS]
          | kw[%ASSERT]
          | kw[%BREAK]
          | kw[%CASE]
          | kw[%CATCH]
          | kw[%CLASS]
          | kw[%CONST]
          | kw[%CONTINUE]
          | kw[%DEF]
          | kw[%DEFAULT]
          | kw[%DO]
          | kw[%ELSE]
          | kw[%ENUM]
          | kw[%EXTENDS]
          | kw[%FINAL]
          | kw[%FINALLY]
          | kw[%FOR]
          | kw[%GOTO]
          | kw[%IF]
          | kw[%IMPLEMENTS]
          | kw[%IMPORT]
          | kw[%IN]
          | kw[%INSTANCEOF]
          | kw[%INTERFACE]
          | kw[%NATIVE]
          | kw[%NEW]
          | kw[%NON_SEALED]
          | kw[%PACKAGE]
          | kw[%PERMITS]
          | kw[%RECORD]
          | kw[%RETURN]
          | kw[%SEALED]
          | kw[%STATIC]
          | kw[%STRICTFP]
          | kw[%SUPER]
          | kw[%SWITCH]
          | kw[%SYNCHRONIZED]
          | kw[%THIS]
          | kw[%THROW]
          | kw[%THROWS]
          | kw[%TRANSIENT]
          | kw[%TRAIT]
          | kw[%THREADSAFE]
          | kw[%TRY]
          | kw[%VAR]
          | kw[%VOLATILE]
          | kw[%WHILE]
          | kw[%YIELD]
          | lit[%NullLiteral]
          | lit[%BooleanLiteral]
          | kw[%BuiltInPrimitiveType]
          | kw[%VOID]
          | kw[%PUBLIC]
          | kw[%PROTECTED]
          | kw[%PRIVATE]

assignOp -> op[( %ASSIGN
               | %ADD_ASSIGN
               | %SUB_ASSIGN
               | %MUL_ASSIGN
               | %DIV_ASSIGN
               | %AND_ASSIGN
               | %OR_ASSIGN
               | %XOR_ASSIGN
               | %RSHIFT_ASSIGN
               | %URSHIFT_ASSIGN
               | %LSHIFT_ASSIGN
               | %MOD_ASSIGN
               | %POWER_ASSIGN
               | %ELVIS_ASSIGN
               )]

lShift -> op[%LT] op[%LT]

rShift -> op[%GT] op[%GT]

urShift -> op[%GT] op[%GT] op[%GT]

shift -> lShift
       | rShift
       | urShift

range -> op[( %RANGE_INCLUSIVE
            | %RANGE_EXCLUSIVE_LEFT
            | %RANGE_EXCLUSIVE_RIGHT
            | %RANGE_EXCLUSIVE_FULL
            )]
new -> kw[%NEW]
dotOp -> punc[%DOT]
       | punc[%SPREAD_DOT]
       | punc[%SAFE_DOT]
       | punc[%SAFE_CHAIN_DOT]

nls -> %NL:* {% nil %}

sep -> (%NL | %SEMI):+ {% nil %}
