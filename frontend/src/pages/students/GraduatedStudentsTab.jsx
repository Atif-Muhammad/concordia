import React from "react";
import { StudentsTableTab } from "./StudentsTableTab";

export const GraduatedStudentsTab = (props) => {
  return <StudentsTableTab status="GRADUATED" {...props} />;
};
