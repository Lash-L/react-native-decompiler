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

import { Visitor, NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { Plugin } from '../../plugin';

/**
 * Resolves and bypasses modules that just export other modules.
 */
export default class PassthroughModuleRemapper extends Plugin {
  readonly pass = 2;
  name = 'PassthroughModuleRemapper';

  getVisitor(): Visitor {
    if (this.module.moduleCode.body.length !== 1) return {};

    return {
      AssignmentExpression: (path: NodePath<t.AssignmentExpression>) => {
        if (!t.isMemberExpression(path.node.left) || !t.isIdentifier(path.node.left?.object) || !t.isIdentifier(path.node.left?.property)) return;
        if (path.scope.getBindingIdentifier(path.node.left.object.name)?.start !== this.module.moduleParam?.start) return;
        if (path.node.left.property.name !== 'exports') return;

        const right = path.get('right');
        if (Array.isArray(right) || !right.isCallExpression()) return;

        const rightCallee = right.get('callee');
        if (Array.isArray(rightCallee)) return;

        if (!rightCallee.isIdentifier() && !rightCallee.isCallExpression()) return;

        const callExpr = rightCallee.isCallExpression()
            ? rightCallee as NodePath<t.CallExpression>
            : right;

        const dependency = this.getModuleDependency(callExpr);
        if (!dependency) return;
        if (rightCallee.isCallExpression() && !dependency.moduleStrings.find((str) => str.includes('Calling PropTypes validators directly is not supported'))) return;
        if (!this.moduleList.some((m) => m.dependencies.includes(this.module.moduleId))) return;

        this.debugLog(`bypassing ${this.module.moduleId} for ${dependency.moduleId} ${dependency.moduleName}`);

        const passthroughDependency = this.moduleList[dependency.moduleId];
        this.module.ignored = true;
        this.module.isNpmModule = true; // flag as NPM module in case this module pass through NPM module
        this.module.moduleName = `${this.module.moduleId} PASSTHROUGH TO ${passthroughDependency.moduleName}`;
        this.moduleList.forEach((module) => {
          module.dependencies = module.dependencies.map((dep) => (dep === this.module.moduleId ? passthroughDependency.moduleId : dep));
        });
      },
    };
  }
}