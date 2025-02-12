import { For } from "solid-js";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { RawDataCategory } from "~/types";

type ShowDataSummaryProps = {
  data: RawDataCategory;
}

export function DataSummaryTable(props: ShowDataSummaryProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Length</TableHead>
          <TableHead># Categories</TableHead>
          <TableHead>Example</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <For each={props.data.columns}>
          {(col) => (
            <TableRow>
              <TableCell>{col.name}</TableCell>
              <TableCell>{col.dtype}</TableCell>
              <TableCell>{col.data.length}</TableCell>
              <TableCell>{col.categories?.length}</TableCell>
              <TableCell>
                {col.categories
                  ? "[" +
                    col.categories!.slice(0, 2).join(", ") +
                    ", ...]"
                  : "[" + col.data.slice(0, 2).join(", ") + ", ...]"}
              </TableCell>
            </TableRow>
          )}
        </For>
      </TableBody>
    </Table>
  );

}