import { CloseIcon } from "@/components/icons";
import { useT } from "@/lib/i18n";
import type { PayMethod } from "@/api/recharge";

interface Props {
  title?: string;
  onPick: (method: PayMethod, label: string) => void;
  onClose: () => void;
}

export function PayMethodModal({ title, onPick, onClose }: Props) {
  const t = useT();
  return (
    <div className="pay-mask" onClick={onClose}>
      <div className="pay-modal" onClick={(e) => e.stopPropagation()}>
        <button className="pay-close" onClick={onClose}><CloseIcon /></button>
        <h3 className="pay-title">{title ?? t("选择支付方式")}</h3>
        <div className="pay-list">
          <button className="pay-row" onClick={() => onPick("wechat_pay", t("微信"))}>
            <span className="pay-ico"><ScanIcon /></span>
            <span className="pay-name">{t("微信支付")}</span>
            <span className="pay-brand"><span className="brand-badge brand-wechat"><WechatIcon /></span></span>
          </button>
          <button className="pay-row" onClick={() => onPick("alipay", t("支付宝"))}>
            <span className="pay-ico"><ScanIcon /></span>
            <span className="pay-name">{t("支付宝")}</span>
            <span className="pay-brand"><span className="brand-badge brand-alipay">支</span></span>
          </button>
          <button className="pay-row" onClick={() => onPick("stripe", t("信用卡"))}>
            <span className="pay-ico"><CardIcon /></span>
            <span className="pay-name">{t("信用卡")}</span>
            <span className="pay-brand"><span className="brand-visa">VISA</span></span>
          </button>
        </div>
      </div>
    </div>
  );
}

const ScanIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 12h10" />
  </svg>
);
const CardIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" />
  </svg>
);
const WechatIcon = () => (
  <svg width="19" height="19" viewBox="0 0 24 24" fill="#fff">
    <path d="M8.7 4C4.9 4 2 6.6 2 9.9c0 1.8.9 3.4 2.4 4.5L3.8 16l2.1-1.1c.6.2 1.2.3 1.9.4-.1-.4-.2-.9-.2-1.4 0-2.9 2.7-5.2 6.1-5.2h.5C13.6 5.9 11.4 4 8.7 4zm-2.3 3.4a.9.9 0 1 1 0 1.8.9.9 0 0 1 0-1.8zm4.6 0a.9.9 0 1 1 0 1.8.9.9 0 0 1 0-1.8z" />
    <path d="M22 14.4c0-2.7-2.6-4.9-5.8-4.9s-5.8 2.2-5.8 4.9 2.6 4.9 5.8 4.9c.6 0 1.2-.1 1.7-.3l1.7.9-.5-1.5c1.3-.9 2.1-2.3 2.1-3.9zm-7.7-1a.8.8 0 1 1 0-1.6.8.8 0 0 1 0 1.6zm3.8 0a.8.8 0 1 1 0-1.6.8.8 0 0 1 0 1.6z" />
  </svg>
);
