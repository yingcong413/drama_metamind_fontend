import type { ReactNode } from "react";
import { Tag, type TagKind } from "@/components/primitives/Tag";

interface Props {
  num: string;
  title: string;
  tags?: TagKind[];
  required?: boolean;
  help?: string;
  example?: string;
  anchor?: string;
  children?: ReactNode;
}

export function SubCard({ num, title, tags = [], required, help, example, anchor, children }: Props) {
  return (
    <div className={`subfield-card ${required ? "required" : ""}`} data-anchor={anchor}>
      <div className="field-header">
        <span className="field-num">{num}</span>
        <span className="field-title">{title}</span>
        {tags.map((t, i) => <Tag key={i} kind={t} />)}
        {required && <span className="dot-req" style={{ marginLeft: 4 }} />}
      </div>
      {help && <div className="field-help">{help}</div>}
      {children}
      {example && (
        <div className="field-example">
          <span className="ex-label">案例</span>{example}
        </div>
      )}
    </div>
  );
}
