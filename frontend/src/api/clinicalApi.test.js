import { apiError } from "./clinicalApi";

test("nested serializer errors are converted into readable field messages", () => {
  const parsed = apiError({
    response: {
      data: {
        items: [{ dose: ["This field is required."], medication: ["Invalid medication."] }],
      },
    },
  });
  expect(parsed.fields.items).toContain("dose: This field is required.");
  expect(parsed.fields.items).toContain("medication: Invalid medication.");
  expect(parsed.fields.items).not.toContain("[object Object]");
});
