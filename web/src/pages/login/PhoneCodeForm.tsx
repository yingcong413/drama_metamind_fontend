import { useEffect, useState } from "react";
import { ChevronIcon } from "@/components/icons";
import { Field } from "@/components/primitives/Field";
import { useT, useTf } from "@/lib/i18n";
import { sendSms } from "@/api/auth";

interface Props {
  phone: string;
  setPhone: (v: string) => void;
  code: string;
  setCode: (v: string) => void;
}

export function PhoneCodeForm({ phone, setPhone, code, setCode }: Props) {
  const t = useT();
  const tf = useTf();
  const [countdown, setCountdown] = useState(0);
  const phoneOk = /^1[3-9]\d{9}$/.test(phone);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const onSend = async () => {
    if (!phoneOk || countdown > 0) return;
    try {
      const r = await sendSms(phone, "login");
      setCountdown(r.next_send_in);
    } catch {
      setCountdown(60);
    }
  };

  return (
    <>
      <Field title={t("手机号")}>
        <div className="phone-input">
          <button className="phone-cc" type="button">
            🇨🇳 +86 <ChevronIcon />
          </button>
          <input
            className="input input-lg"
            style={{ border: "none", paddingLeft: 14 }}
            placeholder={t("请输入 11 位手机号")}
            maxLength={11}
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
            inputMode="numeric"
          />
        </div>
      </Field>

      <Field title={t("验证码")}>
        <div className="code-input">
          <input
            className="input input-lg"
            style={{ border: "none", letterSpacing: "0.4em", fontFamily: "var(--font-mono)" }}
            placeholder={t("6 位短信验证码")}
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            inputMode="numeric"
          />
          <button
            className="code-send"
            type="button"
            disabled={!phoneOk || countdown > 0}
            onClick={onSend}
          >
            {countdown > 0 ? tf("{n}s 后重发", { n: countdown }) : t("获取验证码")}
          </button>
        </div>
        <div className="dim-2" style={{ fontSize: 11, marginTop: 6 }}>
          {phoneOk
            ? tf("验证码将发送至 +86 {a} **** {b}", { a: phone.slice(0, 3), b: phone.slice(7) })
            : t("请输入有效的大陆手机号")}
        </div>
      </Field>
    </>
  );
}
