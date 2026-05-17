import type { ReactNode } from "react";
import { Tag, type TagKind } from "./Tag";

interface Props {
  num?: string;
  title: string;
  tags?: TagKind[];
  help?: string;
  example?: string;
  children?: ReactNode;
}

export function Field({ num, title, tags = [], help, example, children }: Props) {
  return (
    <div className="field">
      <div className="field-header">
        {num && <span className="field-num">{num}</span>}
        <span className="field-title">{title}</span>
        {tags.map((t, i) => <Tag key={i} kind={t} />)}
      </div>
      {help && <div className="field-help">{help}</div>}
      {children}
      {example && (
        <div className="field-example">
          <span className="ex-label">案例</span>
          {example}
        </div>
      )}
    </div>
  );
}
