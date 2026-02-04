import { IInputs, IOutputs } from "./generated/ManifestTypes";
import DataSetInterfaces = ComponentFramework.PropertyHelper.DataSetApi;
type DataSet = ComponentFramework.PropertyTypes.DataSet;

enum CellCalculation {
    Count = 0,
    Sum = 1,
    Average = 2,
    Max = 3,
    Min = 4
}

interface MatrixCell {
    records: ComponentFramework.PropertyHelper.DataSetApi.EntityRecord[];
    value: unknown;
    formattedValue: string;
}

interface MatrixRow {
    rowKey: string;
    rowLabel: string;
    cells: Map<string, MatrixCell>;
    isGroup?: boolean;
    isGroupChild?: boolean;
    groupKey?: string;
    isExpanded?: boolean;
}

export class CustomMatrixPCF implements ComponentFramework.StandardControl<IInputs, IOutputs> {
    private _container: HTMLDivElement;
    private _context: ComponentFramework.Context<IInputs>;
    private _collapsedGroups: Set<string> = new Set<string>();

    constructor() {
        // Empty
    }

    public init(
        context: ComponentFramework.Context<IInputs>,
        notifyOutputChanged: () => void,
        state: ComponentFramework.Dictionary,
        container: HTMLDivElement
    ): void {
        this._container = container;
        this._context = context;
        
        // Restore collapsed groups from state
        if (state && state.collapsedGroups) {
            this._collapsedGroups = new Set(JSON.parse(state.collapsedGroups as string));
        }
    }

    public updateView(context: ComponentFramework.Context<IInputs>): void {
        this._context = context;
        
        // Clear container
        while (this._container.firstChild) {
            this._container.removeChild(this._container.firstChild);
        }

        const mainDiv = document.createElement("div");
        mainDiv.className = "custom-matrix-container";

        // Validate inputs
        const validationError = this.validateInputs(context);
        if (validationError) {
            mainDiv.innerHTML = `<div class="matrix-error">${validationError}</div>`;
            this._container.appendChild(mainDiv);
            return;
        }

        // Check if dataset is loaded
        const dataset = context.parameters.matrixDataSet;
        if (!dataset || !dataset.sortedRecordIds || dataset.sortedRecordIds.length === 0) {
            mainDiv.innerHTML = '<div class="loading-message">No records to display</div>';
            this._container.appendChild(mainDiv);
            return;
        }

        // Render the matrix
        try {
            const matrixTable = this.buildMatrix(context);
            mainDiv.appendChild(matrixTable);
        } catch (error) {
            mainDiv.innerHTML = `<div class="matrix-error">Error rendering matrix: ${error instanceof Error ? error.message : String(error)}</div>`;
        }

        this._container.appendChild(mainDiv);
    }

    private validateInputs(context: ComponentFramework.Context<IInputs>): string | null {
        const rowHeader = context.parameters.rowHeaderField.raw;
        const columnHeader = context.parameters.columnHeaderField.raw;
        const cellContent = context.parameters.cellContentField.raw;
        const calculation = context.parameters.cellCalculation.raw;

        if (!rowHeader) {
            return "Row Header Field is required";
        }
        if (!columnHeader) {
            return "Column Header Field is required";
        }
        if (!cellContent) {
            return "Cell Content Field is required";
        }
        if (calculation === null || calculation === undefined) {
            return "Cell Calculation is required";
        }

        // Validate calculation type against field type
        const dataset = context.parameters.matrixDataSet;
        if (dataset && dataset.columns && dataset.columns.length > 0) {
            const cellColumn = dataset.columns.find(col => col.name === cellContent || col.alias === cellContent);
            
            if (cellColumn) {
                const dataType = cellColumn.dataType;
                const calcType = (calculation as unknown) as CellCalculation;

                // Validate field type compatibility with calculation
                if (calcType === CellCalculation.Sum || calcType === CellCalculation.Average) {
                    if (dataType !== "Whole.None" && 
                        dataType !== "Decimal" && 
                        dataType !== "Currency" && 
                        dataType !== "FP") {
                        return `Cannot perform ${CellCalculation[calcType]} calculation on field type ${dataType}. Only numeric and currency fields are supported for Sum and Average.`;
                    }
                }

                if (calcType === CellCalculation.Max || calcType === CellCalculation.Min) {
                    if (dataType !== "Whole.None" && 
                        dataType !== "Decimal" && 
                        dataType !== "Currency" && 
                        dataType !== "FP" &&
                        dataType !== "DateAndTime.DateOnly" &&
                        dataType !== "DateAndTime.DateAndTime") {
                        return `Cannot perform ${CellCalculation[calcType]} calculation on field type ${dataType}. Only numeric, currency, and date fields are supported for Max and Min.`;
                    }
                }
            }
        }

        return null;
    }

    private buildMatrix(context: ComponentFramework.Context<IInputs>): HTMLTableElement {
        const dataset = context.parameters.matrixDataSet;
        const rowHeaderField = context.parameters.rowHeaderField.raw!;
        const columnHeaderField = context.parameters.columnHeaderField.raw!;
        const cellContentField = context.parameters.cellContentField.raw!;
        const rowGroupField = context.parameters.rowGroupField.raw;
        const calculation = (context.parameters.cellCalculation.raw as unknown) as CellCalculation;
        const showColumnTotals = context.parameters.showColumnTotals.raw;
        const showRowTotals = context.parameters.showRowTotals.raw;

        // Build data structure
        const { rows, columns, groups } = this.processDataset(
            dataset,
            rowHeaderField,
            columnHeaderField,
            cellContentField,
            rowGroupField,
            calculation
        );

        // Create table
        const table = document.createElement("table");
        table.className = "matrix-table";

        // Create header row
        const headerRow = this.createHeaderRow(columns, showRowTotals, columnHeaderField);
        table.appendChild(headerRow);

        // Create data rows
        if (rowGroupField && groups.size > 0) {
            this.createGroupedRows(table, rows, groups, columns, calculation, showRowTotals);
        } else {
            this.createDataRows(table, rows, columns, calculation, showRowTotals);
        }

        // Create totals row
        if (showColumnTotals) {
            const totalsRow = this.createTotalsRow(rows, columns, calculation, showRowTotals);
            table.appendChild(totalsRow);
        }

        return table;
    }

    private processDataset(
        dataset: DataSet,
        rowHeaderField: string,
        columnHeaderField: string,
        cellContentField: string,
        rowGroupField: string | null,
        calculation: CellCalculation
    ): { rows: Map<string, MatrixRow>, columns: string[], groups: Map<string, MatrixRow[]> } {
        const rows = new Map<string, MatrixRow>();
        const columnSet = new Set<string>();
        const groups = new Map<string, MatrixRow[]>();

        // Process each record
        dataset.sortedRecordIds.forEach(recordId => {
            const record = dataset.records[recordId];
            
            const rowValue = this.getFieldValue(record, rowHeaderField);
            const rowKey = String(rowValue);
            const rowLabel = this.getFormattedValue(record, rowHeaderField);
            
            const columnValue = this.getFieldValue(record, columnHeaderField);
            const columnKey = String(columnValue);
            columnSet.add(columnKey);

            // Get or create row
            let row = rows.get(rowKey);
            if (!row) {
                row = {
                    rowKey: rowKey,
                    rowLabel: rowLabel,
                    cells: new Map<string, MatrixCell>(),
                    isGroup: false,
                    isGroupChild: rowGroupField !== null
                };
                
                if (rowGroupField) {
                    const groupValue = this.getFieldValue(record, rowGroupField);
                    row.groupKey = String(groupValue);
                }
                
                rows.set(rowKey, row);
            }

            // Get or create cell
            let cell = row.cells.get(columnKey);
            if (!cell) {
                cell = {
                    records: [],
                    value: null,
                    formattedValue: ""
                };
                row.cells.set(columnKey, cell);
            }

            cell.records.push(record);
        });

        // Build groups if row grouping is enabled
        if (rowGroupField) {
            const groupMap = new Map<string, MatrixRow[]>();
            
            rows.forEach(row => {
                if (row.groupKey) {
                    if (!groupMap.has(row.groupKey)) {
                        groupMap.set(row.groupKey, []);
                    }
                    groupMap.get(row.groupKey)!.push(row);
                }
            });

            // Create group header rows
            groupMap.forEach((groupRows, groupKey) => {
                const groupRow: MatrixRow = {
                    rowKey: `group_${groupKey}`,
                    rowLabel: groupKey,
                    cells: new Map<string, MatrixCell>(),
                    isGroup: true,
                    isExpanded: !this._collapsedGroups.has(groupKey)
                };

                // Aggregate group data
                columnSet.forEach(columnKey => {
                    const cellRecords: ComponentFramework.PropertyHelper.DataSetApi.EntityRecord[] = [];
                    groupRows.forEach(row => {
                        const cell = row.cells.get(columnKey);
                        if (cell) {
                            cellRecords.push(...cell.records);
                        }
                    });

                    if (cellRecords.length > 0) {
                        groupRow.cells.set(columnKey, {
                            records: cellRecords,
                            value: null,
                            formattedValue: ""
                        });
                    }
                });

                groups.set(groupKey, groupRows);
            });
        }

        const columns = Array.from(columnSet).sort();

        // Calculate cell values
        rows.forEach(row => {
            row.cells.forEach((cell, columnKey) => {
                const result = this.calculateCellValue(cell.records, cellContentField, calculation, dataset);
                cell.value = result.value;
                cell.formattedValue = result.formattedValue;
            });
        });

        // Calculate group totals
        groups.forEach((groupRows, groupKey) => {
            const groupRow = rows.get(`group_${groupKey}`);
            if (groupRow) {
                groupRow.cells.forEach((cell, columnKey) => {
                    const result = this.calculateCellValue(cell.records, cellContentField, calculation, dataset);
                    cell.value = result.value;
                    cell.formattedValue = result.formattedValue;
                });
            }
        });

        return { rows, columns, groups };
    }

    private getFieldValue(record: ComponentFramework.PropertyHelper.DataSetApi.EntityRecord, fieldName: string): unknown {
        return record.getValue(fieldName);
    }

    private getFormattedValue(record: ComponentFramework.PropertyHelper.DataSetApi.EntityRecord, fieldName: string): string {
        return record.getFormattedValue(fieldName) || String(record.getValue(fieldName) || "");
    }

    private calculateCellValue(
        records: ComponentFramework.PropertyHelper.DataSetApi.EntityRecord[],
        fieldName: string,
        calculation: CellCalculation,
        dataset: DataSet
    ): { value: unknown, formattedValue: string } {
        if (records.length === 0) {
            return { value: null, formattedValue: "" };
        }

        const column = dataset.columns.find(col => col.name === fieldName || col.alias === fieldName);
        const values = records.map(r => this.getFieldValue(r, fieldName)).filter(v => v !== null && v !== undefined);

        if (values.length === 0 && calculation !== CellCalculation.Count) {
            return { value: null, formattedValue: "" };
        }

        let result: unknown = null;

        switch (calculation) {
            case CellCalculation.Count:
                result = values.length;
                break;
            
            case CellCalculation.Sum:
                result = values.reduce((sum: number, val) => sum + Number(val), 0);
                break;
            
            case CellCalculation.Average: {
                const sum = values.reduce((sum: number, val) => sum + Number(val), 0);
                result = values.length > 0 ? sum / values.length : 0;
                break;
            }
            
            case CellCalculation.Max:
                result = values.reduce((max, val) => {
                    const numVal = val instanceof Date ? val.getTime() : Number(val);
                    const maxVal = max instanceof Date ? max.getTime() : Number(max);
                    return numVal > maxVal ? val : max;
                }, values[0]);
                break;
            
            case CellCalculation.Min:
                result = values.reduce((min, val) => {
                    const numVal = val instanceof Date ? val.getTime() : Number(val);
                    const minVal = min instanceof Date ? min.getTime() : Number(min);
                    return numVal < minVal ? val : min;
                }, values[0]);
                break;
        }

        // Format the result
        let formattedValue = String(result);
        
        if (column && result !== null) {
            if (column.dataType === "Currency") {
                formattedValue = new Intl.NumberFormat(this._context.userSettings.languageId.toString(), {
                    style: 'currency',
                    currency: 'USD' // Default, could be enhanced to use org currency
                }).format(Number(result));
            } else if (column.dataType === "Decimal" || column.dataType === "FP") {
                formattedValue = new Intl.NumberFormat(this._context.userSettings.languageId.toString(), {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                }).format(Number(result));
            } else if (column.dataType === "Whole.None") {
                formattedValue = new Intl.NumberFormat(this._context.userSettings.languageId.toString()).format(Number(result));
            } else if (column.dataType === "DateAndTime.DateOnly" || column.dataType === "DateAndTime.DateAndTime") {
                if (result instanceof Date) {
                    formattedValue = result.toLocaleDateString(this._context.userSettings.languageId.toString());
                }
            }
        }

        return { value: result, formattedValue };
    }

    private createHeaderRow(columns: string[], showRowTotals: boolean, columnHeaderField: string): HTMLTableRowElement {
        const headerRow = document.createElement("tr");
        
        // First column is empty (for row headers)
        const emptyHeader = document.createElement("th");
        emptyHeader.className = "matrix-header-cell";
        headerRow.appendChild(emptyHeader);

        // Determine if we need rotated headers (if columns are long)
        const useRotatedHeaders = columns.some(col => col.length > 15);

        // Column headers
        columns.forEach(columnKey => {
            const th = document.createElement("th");
            th.className = useRotatedHeaders ? "column-header column-header-rotated" : "column-header";
            
            if (useRotatedHeaders) {
                const div = document.createElement("div");
                const span = document.createElement("span");
                span.textContent = columnKey;
                div.appendChild(span);
                th.appendChild(div);
            } else {
                th.textContent = columnKey;
            }
            
            headerRow.appendChild(th);
        });

        // Row totals header
        if (showRowTotals) {
            const totalHeader = document.createElement("th");
            totalHeader.className = "matrix-header-cell";
            totalHeader.textContent = "Total";
            headerRow.appendChild(totalHeader);
        }

        return headerRow;
    }

    private createDataRows(
        table: HTMLTableElement,
        rows: Map<string, MatrixRow>,
        columns: string[],
        calculation: CellCalculation,
        showRowTotals: boolean
    ): void {
        const sortedRows = Array.from(rows.values()).sort((a, b) => a.rowLabel.localeCompare(b.rowLabel));

        sortedRows.forEach(row => {
            if (row.isGroup) return; // Skip group rows in non-grouped rendering

            const tr = document.createElement("tr");

            // Row header
            const rowHeader = document.createElement("td");
            rowHeader.className = "matrix-header-cell";
            rowHeader.textContent = row.rowLabel;
            tr.appendChild(rowHeader);

            // Data cells
            const rowRecords: ComponentFramework.PropertyHelper.DataSetApi.EntityRecord[] = [];
            columns.forEach(columnKey => {
                const cell = row.cells.get(columnKey);
                const td = document.createElement("td");
                td.className = "matrix-cell";
                
                if (cell && cell.records.length > 0) {
                    td.textContent = cell.formattedValue;
                    rowRecords.push(...cell.records);
                } else {
                    td.textContent = "-";
                    td.classList.add("empty-cell");
                }
                
                tr.appendChild(td);
            });

            // Row total
            if (showRowTotals && rowRecords.length > 0) {
                const totalCell = document.createElement("td");
                totalCell.className = "matrix-cell total-cell";
                const cellContentField = this._context.parameters.cellContentField.raw!;
                const result = this.calculateCellValue(
                    rowRecords,
                    cellContentField,
                    calculation,
                    this._context.parameters.matrixDataSet
                );
                totalCell.textContent = result.formattedValue;
                tr.appendChild(totalCell);
            } else if (showRowTotals) {
                const totalCell = document.createElement("td");
                totalCell.className = "matrix-cell total-cell empty-cell";
                totalCell.textContent = "-";
                tr.appendChild(totalCell);
            }

            table.appendChild(tr);
        });
    }

    private createGroupedRows(
        table: HTMLTableElement,
        rows: Map<string, MatrixRow>,
        groups: Map<string, MatrixRow[]>,
        columns: string[],
        calculation: CellCalculation,
        showRowTotals: boolean
    ): void {
        const sortedGroups = Array.from(groups.keys()).sort();

        sortedGroups.forEach(groupKey => {
            const groupRows = groups.get(groupKey)!;
            const groupRow = rows.get(`group_${groupKey}`);

            if (!groupRow) return;

            // Create group header row
            const groupTr = document.createElement("tr");
            groupTr.className = "row-group-header";
            groupTr.onclick = () => this.toggleGroup(groupKey);

            // Group header cell
            const groupHeader = document.createElement("td");
            groupHeader.className = "matrix-header-cell";
            const toggleIcon = document.createElement("span");
            toggleIcon.className = "group-toggle";
            toggleIcon.textContent = groupRow.isExpanded ? "▼" : "▶";
            groupHeader.appendChild(toggleIcon);
            groupHeader.appendChild(document.createTextNode(groupRow.rowLabel));
            groupTr.appendChild(groupHeader);

            // Group total cells
            const groupRecords: ComponentFramework.PropertyHelper.DataSetApi.EntityRecord[] = [];
            columns.forEach(columnKey => {
                const cell = groupRow.cells.get(columnKey);
                const td = document.createElement("td");
                td.className = "matrix-cell group-total-cell";
                
                if (cell && cell.records.length > 0) {
                    td.textContent = cell.formattedValue;
                    groupRecords.push(...cell.records);
                } else {
                    td.textContent = "-";
                    td.classList.add("empty-cell");
                }
                
                groupTr.appendChild(td);
            });

            // Group row total
            if (showRowTotals && groupRecords.length > 0) {
                const totalCell = document.createElement("td");
                totalCell.className = "matrix-cell group-total-cell";
                const cellContentField = this._context.parameters.cellContentField.raw!;
                const result = this.calculateCellValue(
                    groupRecords,
                    cellContentField,
                    calculation,
                    this._context.parameters.matrixDataSet
                );
                totalCell.textContent = result.formattedValue;
                groupTr.appendChild(totalCell);
            } else if (showRowTotals) {
                const totalCell = document.createElement("td");
                totalCell.className = "matrix-cell group-total-cell empty-cell";
                totalCell.textContent = "-";
                groupTr.appendChild(totalCell);
            }

            table.appendChild(groupTr);

            // Create child rows (if expanded)
            if (groupRow.isExpanded) {
                const sortedGroupRows = groupRows.sort((a, b) => a.rowLabel.localeCompare(b.rowLabel));
                sortedGroupRows.forEach(row => {
                    const tr = document.createElement("tr");
                    tr.className = "row-group-child";

                    // Row header
                    const rowHeader = document.createElement("td");
                    rowHeader.className = "matrix-header-cell";
                    rowHeader.textContent = row.rowLabel;
                    tr.appendChild(rowHeader);

                    // Data cells
                    const rowRecords: ComponentFramework.PropertyHelper.DataSetApi.EntityRecord[] = [];
                    columns.forEach(columnKey => {
                        const cell = row.cells.get(columnKey);
                        const td = document.createElement("td");
                        td.className = "matrix-cell";
                        
                        if (cell && cell.records.length > 0) {
                            td.textContent = cell.formattedValue;
                            rowRecords.push(...cell.records);
                        } else {
                            td.textContent = "-";
                            td.classList.add("empty-cell");
                        }
                        
                        tr.appendChild(td);
                    });

                    // Row total
                    if (showRowTotals && rowRecords.length > 0) {
                        const totalCell = document.createElement("td");
                        totalCell.className = "matrix-cell total-cell";
                        const cellContentField = this._context.parameters.cellContentField.raw!;
                        const result = this.calculateCellValue(
                            rowRecords,
                            cellContentField,
                            calculation,
                            this._context.parameters.matrixDataSet
                        );
                        totalCell.textContent = result.formattedValue;
                        tr.appendChild(totalCell);
                    } else if (showRowTotals) {
                        const totalCell = document.createElement("td");
                        totalCell.className = "matrix-cell total-cell empty-cell";
                        totalCell.textContent = "-";
                        tr.appendChild(totalCell);
                    }

                    table.appendChild(tr);
                });
            }
        });
    }

    private createTotalsRow(
        rows: Map<string, MatrixRow>,
        columns: string[],
        calculation: CellCalculation,
        showRowTotals: boolean
    ): HTMLTableRowElement {
        const totalsRow = document.createElement("tr");

        // "Total" label
        const totalLabel = document.createElement("td");
        totalLabel.className = "matrix-header-cell total-cell";
        totalLabel.textContent = "Total";
        totalsRow.appendChild(totalLabel);

        const cellContentField = this._context.parameters.cellContentField.raw!;
        const dataset = this._context.parameters.matrixDataSet;
        const grandTotalRecords: ComponentFramework.PropertyHelper.DataSetApi.EntityRecord[] = [];

        // Column totals
        columns.forEach(columnKey => {
            const columnRecords: ComponentFramework.PropertyHelper.DataSetApi.EntityRecord[] = [];
            
            rows.forEach(row => {
                if (row.isGroup) return; // Don't double-count group rows
                const cell = row.cells.get(columnKey);
                if (cell) {
                    columnRecords.push(...cell.records);
                }
            });

            const td = document.createElement("td");
            td.className = "matrix-cell total-cell";
            
            if (columnRecords.length > 0) {
                const result = this.calculateCellValue(columnRecords, cellContentField, calculation, dataset);
                td.textContent = result.formattedValue;
                grandTotalRecords.push(...columnRecords);
            } else {
                td.textContent = "-";
                td.classList.add("empty-cell");
            }
            
            totalsRow.appendChild(td);
        });

        // Grand total (if row totals are shown)
        if (showRowTotals) {
            const grandTotalCell = document.createElement("td");
            grandTotalCell.className = "matrix-cell total-cell";
            
            if (grandTotalRecords.length > 0) {
                // Remove duplicates
                const uniqueRecords = Array.from(new Set(grandTotalRecords.map(r => r.getRecordId())))
                    .map(id => grandTotalRecords.find(r => r.getRecordId() === id)!);
                
                const result = this.calculateCellValue(uniqueRecords, cellContentField, calculation, dataset);
                grandTotalCell.textContent = result.formattedValue;
            } else {
                grandTotalCell.textContent = "-";
                grandTotalCell.classList.add("empty-cell");
            }
            
            totalsRow.appendChild(grandTotalCell);
        }

        return totalsRow;
    }

    private toggleGroup(groupKey: string): void {
        if (this._collapsedGroups.has(groupKey)) {
            this._collapsedGroups.delete(groupKey);
        } else {
            this._collapsedGroups.add(groupKey);
        }
        
        // Save state
        this._context.mode.setControlState({
            collapsedGroups: JSON.stringify(Array.from(this._collapsedGroups))
        });
        
        // Trigger refresh
        this.updateView(this._context);
    }

    public getOutputs(): IOutputs {
        return {};
    }

    public destroy(): void {
        // Cleanup if necessary
    }
}
