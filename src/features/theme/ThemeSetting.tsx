import { useId } from "react";

import type { InterfaceLanguage } from "../interfaceLanguage/interfaceLanguage";
import { useMessages } from "../interfaceLanguage/InterfaceLanguageContext";
import { FOLLOW_SYSTEM } from "./ThemeCatalog";
import type { ThemeMenu } from "./ThemeSession";

type ThemeSettingProps = {
  menu: ThemeMenu;
  language: InterfaceLanguage;
};

/** The theme row of the settings: Follow System first, then every shipped theme. */
export function ThemeSetting({ menu, language }: ThemeSettingProps) {
  const messages = useMessages();
  const labelId = useId();

  return (
    <section className="settings-item">
      <h3 id={labelId}>{messages.theme}</h3>
      <select
        className="settings-select"
        aria-labelledby={labelId}
        value={menu.choice}
        onChange={(event) => menu.choose(event.target.value)}
      >
        <option value={FOLLOW_SYSTEM}>{messages.followSystem}</option>
        {menu.themes.map((theme) => (
          <option key={theme.id} value={theme.id}>
            {theme.nameIn(language)}
          </option>
        ))}
      </select>
    </section>
  );
}
