/**
 * Safe predicate interpreter for device-config `assertion_rules[].expr` (engine #2).
 * Whitelisted grammar ONLY — parsed with a recursive-descent parser and evaluated
 * by hand. NEVER eval()/Function() (that would be arbitrary code execution from a
 * spec). Grammar:
 *   expr   := or
 *   or     := and ('||' and)*
 *   and    := cmp ('&&' cmp)*
 *   cmp    := unary (('=='|'!='|'>='|'<='|'>'|'<') unary)?
 *   unary  := '!' unary | primary
 *   primary:= '(' expr ')' | call | literal
 *   call   := field('id') | set_before('a','b') | reassigned_before('a','b')
 *   literal:= 'string' | number | true | false
 */
export interface ExprContext {
  /** Current value of each field. */
  fields: Map<string, unknown>;
  /** Field ids in the order they were edited (oldest first); a field edited twice appears twice. */
  editOrder: string[];
}

type Tok =
  | { t: 'op'; v: string }
  | { t: 'lparen' }
  | { t: 'rparen' }
  | { t: 'comma' }
  | { t: 'str'; v: string }
  | { t: 'num'; v: number }
  | { t: 'bool'; v: boolean }
  | { t: 'ident'; v: string };

const FUNCS = new Set(['field', 'set_before', 'reassigned_before']);

function tokenize(src: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  const isIdent = (c: string) => /[A-Za-z_]/.test(c);
  while (i < src.length) {
    const c = src[i] as string;
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (c === '(') {
      toks.push({ t: 'lparen' });
      i++;
    } else if (c === ')') {
      toks.push({ t: 'rparen' });
      i++;
    } else if (c === ',') {
      toks.push({ t: 'comma' });
      i++;
    } else if (c === "'") {
      let j = i + 1;
      let s = '';
      while (j < src.length && src[j] !== "'") s += src[j++];
      if (src[j] !== "'") throw new Error('unterminated string literal');
      toks.push({ t: 'str', v: s });
      i = j + 1;
    } else if (c === '&' || c === '|') {
      if (src[i + 1] !== c) throw new Error(`expected ${c}${c}`);
      toks.push({ t: 'op', v: c + c });
      i += 2;
    } else if (c === '=' || c === '!' || c === '>' || c === '<') {
      if (src[i + 1] === '=') {
        toks.push({ t: 'op', v: c + '=' });
        i += 2;
      } else if (c === '!') {
        toks.push({ t: 'op', v: '!' });
        i++;
      } else if (c === '>' || c === '<') {
        toks.push({ t: 'op', v: c });
        i++;
      } else {
        throw new Error(`unexpected '${c}' (use == for equality)`);
      }
    } else if (/[0-9]/.test(c) || (c === '-' && /[0-9]/.test(src[i + 1] ?? ''))) {
      let j = i + 1;
      while (j < src.length && /[0-9.]/.test(src[j] as string)) j++;
      toks.push({ t: 'num', v: Number(src.slice(i, j)) });
      i = j;
    } else if (isIdent(c)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_]/.test(src[j] as string)) j++;
      const word = src.slice(i, j);
      if (word === 'true' || word === 'false') toks.push({ t: 'bool', v: word === 'true' });
      else toks.push({ t: 'ident', v: word });
      i = j;
    } else {
      throw new Error(`illegal character '${c}' in expr`);
    }
  }
  return toks;
}

class Parser {
  private pos = 0;
  constructor(
    private toks: Tok[],
    private ctx: ExprContext,
  ) {}

  private peek(): Tok | undefined {
    return this.toks[this.pos];
  }
  private next(): Tok {
    const t = this.toks[this.pos++];
    if (!t) throw new Error('unexpected end of expr');
    return t;
  }
  private expect(t: Tok['t']): Tok {
    const tok = this.next();
    if (tok.t !== t) throw new Error(`expected ${t}, got ${tok.t}`);
    return tok;
  }

  parse(): unknown {
    const v = this.or();
    if (this.pos !== this.toks.length) throw new Error('trailing tokens in expr');
    return v;
  }

  private or(): unknown {
    let left = this.and();
    while (this.peek()?.t === 'op' && (this.peek() as { v: string }).v === '||') {
      this.next();
      const right = this.and();
      left = Boolean(left) || Boolean(right);
    }
    return left;
  }
  private and(): unknown {
    let left = this.cmp();
    while (this.peek()?.t === 'op' && (this.peek() as { v: string }).v === '&&') {
      this.next();
      const right = this.cmp();
      left = Boolean(left) && Boolean(right);
    }
    return left;
  }
  private cmp(): unknown {
    const left = this.unary();
    const op = this.peek();
    if (op?.t === 'op' && ['==', '!=', '>', '<', '>=', '<='].includes(op.v)) {
      this.next();
      const right = this.unary();
      switch (op.v) {
        case '==':
          return left === right;
        case '!=':
          return left !== right;
        case '>':
          return Number(left) > Number(right);
        case '<':
          return Number(left) < Number(right);
        case '>=':
          return Number(left) >= Number(right);
        case '<=':
          return Number(left) <= Number(right);
      }
    }
    return left;
  }
  private unary(): unknown {
    const t = this.peek();
    if (t?.t === 'op' && t.v === '!') {
      this.next();
      return !this.unary();
    }
    return this.primary();
  }
  private primary(): unknown {
    const t = this.next();
    if (t.t === 'lparen') {
      const v = this.or();
      this.expect('rparen');
      return v;
    }
    if (t.t === 'str') return t.v;
    if (t.t === 'num') return t.v;
    if (t.t === 'bool') return t.v;
    if (t.t === 'ident') {
      if (!FUNCS.has(t.v))
        throw new Error(`unknown identifier '${t.v}' (only field/set_before/reassigned_before)`);
      this.expect('lparen');
      const args: string[] = [];
      if (this.peek()?.t !== 'rparen') {
        for (;;) {
          const a = this.expect('str') as { v: string };
          args.push(a.v);
          if (this.peek()?.t === 'comma') this.next();
          else break;
        }
      }
      this.expect('rparen');
      return this.callFn(t.v, args);
    }
    throw new Error(`unexpected token ${t.t}`);
  }
  private firstIndex(id: string): number {
    return this.ctx.editOrder.indexOf(id);
  }
  private callFn(name: string, args: string[]): unknown {
    if (name === 'field') {
      if (args.length !== 1) throw new Error('field() takes one arg');
      return this.ctx.fields.get(args[0] as string);
    }
    // set_before('a','b'): a was first set strictly before b was first set.
    if (name === 'set_before') {
      if (args.length !== 2) throw new Error('set_before() takes two args');
      const ia = this.firstIndex(args[0] as string);
      const ib = this.firstIndex(args[1] as string);
      return ia !== -1 && (ib === -1 || ia < ib);
    }
    // reassigned_before('a','b'): a was edited (its LAST edit) before b's first set.
    if (name === 'reassigned_before') {
      if (args.length !== 2) throw new Error('reassigned_before() takes two args');
      const lastA = this.ctx.editOrder.lastIndexOf(args[0] as string);
      const ib = this.firstIndex(args[1] as string);
      return lastA !== -1 && (ib === -1 || lastA < ib);
    }
    throw new Error(`unknown function '${name}'`);
  }
}

/** Evaluate a whitelisted predicate to a boolean. Throws on any non-grammar input. */
export function evalExpr(expr: string, ctx: ExprContext): boolean {
  const result = new Parser(tokenize(expr), ctx).parse();
  return Boolean(result);
}
