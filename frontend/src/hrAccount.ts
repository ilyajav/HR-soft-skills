export const getHrCabinetLabel = (): string => {
  const hrUsername = window.localStorage.getItem("hr_username")?.trim();

  return hrUsername ? `Кабинет сотрудника (${hrUsername})` : "Кабинет сотрудника";
};
