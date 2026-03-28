export const getHrCabinetLabel = (): string => {
  const hrUsername = window.localStorage.getItem("hr_username")?.trim();

  return hrUsername ? `Кабинет HR (${hrUsername})` : "Кабинет HR";
};
