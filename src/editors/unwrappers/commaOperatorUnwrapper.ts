/**
  React Native Decompiler
  Copyright (C) 2020-2022 Richard Fu, Numan and contributors
  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU Affero General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.
  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU Affero General Public License for more details.
  You should have received a copy of the GNU Affero General Public License
  along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import * as t from '@babel/types';
import { NodePath, Visitor } from '@babel/traverse';
import { Plugin } from '../../plugin';

/**
 * Seperates statements wrapped in comma operations `(a, b)` into seperate lines
 */
export default class CommaOperatorUnwrapper extends Plugin {
  readonly pass = 1;
  readonly name = 'CommaOperatorUnwrapper';

  getVisitor(): Visitor {
    return {
      ReturnStatement: (path) => {
        const argument = path.get('argument');
        if (!argument.isSequenceExpression()) return;
        const expressions = argument.get('expressions');
        if (!Array.isArray(expressions) || expressions.length <= 1) return;

        this.debugLog('ReturnStatement:');
        this.debugLog(this.debugPathToCode(path));

        path.insertBefore(this.sequenceExpressionToStatements((expressions as NodePath<t.Expression>[]).slice(0, -1).map((e: NodePath<t.Expression>) => e.node)));
        for (let i = 0; i < expressions.length - 1; i += 1) {
          (expressions[i] as NodePath).remove();
        }
        const argumentPath = path.get('argument');
        if (!Array.isArray(argumentPath)) {
          argumentPath.replaceWith(expressions[expressions.length - 1] as NodePath);
        }
      },
      VariableDeclaration: (path) => {
        const declarations = path.get('declarations');
        if (!Array.isArray(declarations)) return;

        declarations.forEach((declarator: NodePath<t.VariableDeclarator>) => {
          const init = declarator.get('init');
          if (!init.isSequenceExpression()) return;

          const expressions = init.get('expressions');
          if (!Array.isArray(expressions)) return;

          const validExpressions = (expressions as NodePath<t.Expression>[]).filter((expression: NodePath<t.Expression>) => {
            if (!expression.isAssignmentExpression()) return true;
            if (!t.isIdentifier(expression.node.left)) return true;

            const matchingDeclaration = declarations.find((declar) => t.isIdentifier(declar.node.id) && declar.node.id.name === (expression.node.left as t.Identifier).name);
            if (!matchingDeclaration) return true;

            const rightPath = expression.get('right');
            if (Array.isArray(rightPath)) return true;

            const matchingInit = matchingDeclaration.get('init');
            if (Array.isArray(matchingInit)) return true;

            matchingInit.replaceWith(rightPath.node);
            expression.remove();
            return false;
          });

          if (validExpressions.length === 0) return;

          path.insertBefore(this.sequenceExpressionToStatements(validExpressions.slice(0, -1).map((e: NodePath<t.Expression>) => e.node)));
          for (let i = 0; i < validExpressions.length - 1; i += 1) {
            (validExpressions[i] as NodePath).remove();
          }
          const declaratorInit = declarator.get('init');
          if (!Array.isArray(declaratorInit)) {
            declaratorInit.replaceWith(validExpressions[validExpressions.length - 1] as NodePath);
          }
        });
      },
      ExpressionStatement: (path) => {
        const expression = path.get('expression');
        if (!expression.isSequenceExpression()) return;
        const expressions = expression.get('expressions');
        if (!Array.isArray(expressions) || expressions.length <= 1) return;

        this.debugLog('ExpressionStatement:');
        this.debugLog(this.debugPathToCode(path));

        path.replaceWithMultiple(this.sequenceExpressionToStatements(expression.node.expressions));
      },
    };
  }

  private sequenceExpressionToStatements(expressions: t.Expression[]): t.Statement[] {
    const validExpressions = expressions.filter((exp) => {
      if (t.isMemberExpression(exp) && t.isIdentifier(exp.object) && t.isLiteral(exp.property)) return false;
      if (t.isMemberExpression(exp) && t.isIdentifier(exp.object) && t.isIdentifier(exp.property)) return false;
      return true;
    });
    return validExpressions.map((exp) => t.expressionStatement(exp));
  }
}