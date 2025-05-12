import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

const formSchema = z.object({
  name: z.string().min(3).max(64),
  category_code: z.string().min(1),
  currency: z.string().length(3),
  current_value: z.number().nonnegative(),
  current_quantity: z.number().nonnegative(),
  description: z.string().optional(),
});

export function NewHoldingForm() {
  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      category_code: "",
      currency: "",
      current_value: 0,
      current_quantity: 0,
      description: "",
    },
  });

  // Submit handler
  async function onSubmit(values: z.infer<typeof formSchema>) {
    console.log(values);
  }

  return <div>NewHoldingForm</div>;
}
