import React from "react";
import { StudentsTableTab } from "./StudentsTableTab";

export const ActiveStudentsTab = (props) => {
  return <StudentsTableTab status="ACTIVE" {...props} />;
};
