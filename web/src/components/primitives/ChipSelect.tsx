import { useT } from "@/lib/i18n";

interface SingleProps {
  options: string[];
  value: string | null | undefined;
  onChange: (v: string | null) => void;
  multi?: false;
  layerClass?: string;
}
interface MultiProps {
  options: string[];
  value: string[] | undefined;
  onChange: (v: string[]) => void;
  multi: true;
  layerClass?: string;
}
type Props = SingleProps | MultiProps;

export function ChipSelect(props: Props) {
  const t = useT();
  const isSel = (o: string) => {
    if (props.multi) return (props.value ?? []).includes(o);
    return props.value === o;
  };
  const toggle = (o: string) => {
    if (props.multi) {
      const set = new Set(props.value ?? []);
      if (set.has(o)) set.delete(o);
      else set.add(o);
      props.onChange([...set]);
    } else {
      props.onChange(props.value === o ? null : o);
    }
  };
  return (
    <div className="chips">
      {props.options.map((o) => (
        <button
          key={o}
          className={`chip ${isSel(o) ? "selected " + (props.layerClass ?? "") : ""}`}
          onClick={() => toggle(o)}
        >
          {t(o)}
        </button>
      ))}
    </div>
  );
}
