"use client";

import { Form as FormPrimitive } from "@base-ui/react/form";

function Form(props: FormPrimitive.Props) {
  return <FormPrimitive data-slot="form" {...props} />;
}

export { Form };
