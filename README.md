# Custom Matrix PCF

A highly configurable Power Apps Component Framework (PCF) control for displaying child records in a custom matrix format within Model-Driven Apps.

## Overview

This PCF control transforms subgrid data into an interactive matrix view with user-defined rows, columns, and aggregated cell values. It's designed to provide powerful data visualization and analysis capabilities directly within Dynamics 365 forms.

## Features

### Core Functionality
- **Dynamic Matrix Rendering**: Automatically generates a matrix based on your data and configuration
- **Flexible Aggregations**: Support for Count, Sum, Average, Max, and Min calculations
- **Row Grouping**: Optional expandable/collapsible row groups with subtotals
- **Column & Row Totals**: Optional totals displayed at bottom and right side of the matrix
- **Smart Validation**: Pre-validates field types against calculation methods to prevent invalid operations

### User Experience
- **Formatted Values**: Displays currency, numbers, and dates using Dynamics 365 formatting
- **Space Optimization**: Rotates long column headers 45° to save horizontal space
- **Responsive Design**: Adapts to available space with scrolling support
- **Model-Driven App Styling**: Uses standard Dynamics 365 colors and fonts
- **Interactive Groups**: Click to expand/collapse row groups with persistent state

## Configuration

### Required Parameters

1. **Row Header Field** (Required)
   - Any field from the child record entity
   - Creates the rows of the matrix
   - Example: Product Name, Employee Name, etc.

2. **Column Header Field** (Required)
   - Any field from the child record entity
   - Creates the columns of the matrix
   - Example: Month, Status, Category, etc.

3. **Cell Content Field** (Required)
   - Any field except lookup fields
   - Defines the data to be aggregated in each cell
   - Example: Revenue, Hours, Quantity, etc.

4. **Cell Calculation** (Required)
   - **Count**: Counts records (works with all data types)
   - **Sum**: Adds values (numbers, currency only)
   - **Average**: Calculates average (numbers, currency only)
   - **Max**: Finds maximum (numbers, currency, dates)
   - **Min**: Finds minimum (numbers, currency, dates)

5. **Show Column Totals** (Required)
   - Boolean: Yes/No
   - Displays aggregated totals at the bottom of each column

6. **Show Row Totals** (Required)
   - Boolean: Yes/No
   - Displays aggregated totals at the end of each row

### Optional Parameters

1. **Row Group Field** (Optional)
   - Any field from the child record entity
   - Creates expandable/collapsible groups of rows
   - Shows subtotals when collapsed
   - Example: Department, Region, Year, etc.

## Installation

### Build the Control

```powershell
# Install dependencies
npm install

# Build the control
npm run build

# Build for production
npm run build -- --buildMode production
```

### Create Solution Package

```powershell
# Create a solution project (one-time setup)
pac solution init --publisher-name YourPublisher --publisher-prefix prefix

# Add reference to the PCF control
pac solution add-reference --path ..\

# Build the solution
msbuild /t:build /restore

# The solution zip will be in the bin\Debug or bin\Release folder
```

### Import into Dynamics 365

1. Navigate to Power Apps (make.powerapps.com)
2. Go to Solutions
3. Import the solution zip file
4. Publish all customizations

### Configure on a Form

1. Open the form editor for your entity
2. Add or select a subgrid
3. Switch to the "Controls" tab
4. Click "Add Control"
5. Select "CustomMatrixPCF"
6. Configure all required and optional properties
7. Save and publish the form

## Example Use Cases

### Sales Matrix by Month
- **Row Header**: Sales Person
- **Column Header**: Month
- **Cell Content**: Revenue
- **Calculation**: Sum
- **Row Totals**: Yes (total sales per person)
- **Column Totals**: Yes (total sales per month)

### Project Hours by Team
- **Row Header**: Team Member
- **Row Group**: Department
- **Column Header**: Project Name
- **Cell Content**: Hours Worked
- **Calculation**: Sum
- **Row Totals**: Yes (total hours per person)
- **Column Totals**: Yes (total hours per project)

### Order Tracking
- **Row Header**: Product Category
- **Column Header**: Order Status
- **Cell Content**: Order ID
- **Calculation**: Count
- **Row Totals**: Yes (total orders per category)
- **Column Totals**: Yes (total orders per status)

## Validation & Error Handling

The control performs pre-validation to ensure data type compatibility:

- **Sum/Average**: Only works with numeric and currency fields
- **Max/Min**: Works with numeric, currency, and date fields
- **Count**: Works with all field types

If an invalid configuration is detected, the control displays a clear error message explaining the issue instead of showing a generic error.

## Technical Details

### Technology Stack
- TypeScript
- Power Apps Component Framework (PCF)
- Model-Driven Apps styling

### Browser Support
- Microsoft Edge (Chromium)
- Google Chrome
- Mozilla Firefox
- Safari

### Performance Considerations
- Optimized for datasets up to 5,000 records
- Efficient rendering with virtual scrolling for large matrices
- Minimal re-renders on group expand/collapse

## Development

### Run in Test Harness

```powershell
npm start watch
```

This will start the PCF test harness where you can test the control with sample data.

### Project Structure

```
custom-matrix-pcf/
├── CustomMatrixPCF/
│   ├── css/
│   │   └── CustomMatrixPCF.css
│   ├── ControlManifest.Input.xml
│   └── index.ts
├── out/
├── package.json
├── pcfconfig.json
└── tsconfig.json
```

## Best Practices

1. **Field Selection**: Choose fields that provide meaningful groupings for rows and columns
2. **Data Volume**: Keep subgrids filtered to relevant records for better performance
3. **Validation**: Always test with your actual data to ensure field types match calculations
4. **Column Count**: Limit columns to 10-15 for optimal readability
5. **Row Groups**: Use when you have natural hierarchies in your data

## Troubleshooting

### Control Not Appearing
- Ensure the solution is imported and published
- Verify the control is enabled for Web
- Check that all required parameters are configured

### Validation Errors
- Review the error message displayed in the control
- Verify field types match the selected calculation
- Ensure field names are spelled correctly

### Formatting Issues
- Check browser zoom level (100% recommended)
- Verify sufficient space is allocated to the subgrid
- Try toggling column header rotation by adjusting available width

## Support & Contribution

For issues, feature requests, or contributions, please refer to the project repository.

## License

[Specify your license here]

## Version History

### 0.0.1 (Initial Release)
- Dynamic matrix rendering
- Support for all calculation types
- Row grouping with subtotals
- Column and row totals
- Formatted value display
- Pre-validation of inputs
- Responsive design with space optimization
