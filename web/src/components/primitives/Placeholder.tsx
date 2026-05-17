interface Props {
  label?: string;
}

export function Placeholder({ label = "图像占位" }: Props) {
  return <div className="placeholder-img">{label}</div>;
}
