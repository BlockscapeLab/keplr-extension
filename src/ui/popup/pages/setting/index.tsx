import React, { FunctionComponent, useCallback, useMemo } from "react";
import { HeaderLayout } from "../../layouts/header-layout";
import { useHistory } from "react-router";
import { PageButton } from "./page-button";

import style from "./style.module.scss";
import { useLanguage } from "../../language";
import { useIntl } from "react-intl";

export const SettingPage: FunctionComponent = () => {
  const language = useLanguage();
  const history = useHistory();
  const intl = useIntl();

  const paragraphLang = language.automatic
    ? intl.formatMessage(
        {
          id: "setting.language.automatic-with-language"
        },
        {
          language: intl.formatMessage({
            id: `setting.language.${language.language}`
          })
        }
      )
    : intl.formatMessage({
        id: `setting.language.${language.language}`
      });

  return (
    <HeaderLayout
      showChainName={false}
      canChangeChainInfo={false}
      alternativeTitle={intl.formatMessage({
        id: "main.menu.settings"
      })}
      onBackButton={useCallback(() => {
        history.goBack();
      }, [history])}
    >
      <div className={style.container}>
        <PageButton
          title={intl.formatMessage({
            id: "setting.language"
          })}
          paragraph={paragraphLang}
          onClick={useCallback(() => {
            history.push({
              pathname: "/setting/language"
            });
          }, [history])}
          icons={useMemo(
            () => [<i key="next" className="fas fa-chevron-right" />],
            []
          )}
        />
        <PageButton
          title={intl.formatMessage({
            id: "setting.connections"
          })}
          paragraph={intl.formatMessage({
            id: "setting.connections.paragraph"
          })}
          onClick={useCallback(() => {
            history.push({
              pathname: "/setting/connections"
            });
          }, [history])}
          icons={useMemo(
            () => [<i key="next" className="fas fa-chevron-right" />],
            []
          )}
        />
      </div>
    </HeaderLayout>
  );
};
