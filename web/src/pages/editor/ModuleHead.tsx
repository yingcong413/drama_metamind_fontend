import type { ReactNode } from "react";
import { Tag, type TagKind } from "@/components/primitives/Tag";
import { LayerChip, type LayerKind } from "@/components/primitives/LayerChip";
import { useT } from "@/lib/i18n";

interface Props {
  layer: LayerKind;
  num: string;
  title: string;
  help?: string;
  tags?: TagKind[];
  required?: boolean;
  extra?: ReactNode;
}

export function ModuleHead({ layer, num, title, help, tags = [], required, extra }: Props) {
  const t = useT();
  return (
    <div className="module-head">
      <span className={`num-badge ${layer}`}>{num}</span>
      <div style={{ flex: 1 }}>
        <h1>
          {t(title)}
          {required && <span className="dot-req" title={t("必填")} />}
        </h1>
        {help && <div className="sub">{t(help)}</div>}
        <div className="tags">
          <LayerChip layer={layer} />
          {tags.map((t, i) => <Tag key={i} kind={t} />)}
        </div>
      </div>
      {extra}
    </div>
  );
}
