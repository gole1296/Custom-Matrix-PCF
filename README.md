# Custom Matrix PCF Control

A powerful pivot table/matrix control for Power Platform subgrids that enables dynamic data aggregation and visualization directly within model-driven apps.

## Overview

The Custom Matrix PCF control transforms standard subgrid data into interactive matrix visualizations, allowing users to analyze data across two dimensions with various aggregation methods. Perfect for dashboards, reports, and data analysis scenarios where you need to see patterns and relationships in your data.

### Key Features

- **Multi-dimensional Analysis**: Group data by two fields (rows and columns) simultaneously
- **Flexible Aggregations**: Support for Count, Sum, Average, Minimum, and Maximum
- **Auto-calculated Totals**: Optional row and column totals with grand total
- **Dynamic Titles**: Automatically generated descriptive titles with accent bar styling
- **Smart Formatting**: Automatic formatting based on field data types (currency, decimals, dates, etc.)
- **Fluent UI Integration**: Native Microsoft design system for seamless app integration

## Installation

### Prerequisites

- Power Platform environment (Production, Sandbox, or Developer)
- System Administrator or System Customizer security role
- Power Apps Component Framework (PCF) enabled in your environment (enabled by default in most environments)

### Deployment Steps

1. **Download the Managed Solution**
   - Go to the [Releases](../../releases) page
   - Download the latest `CustomMatrixPCF_managed.zip` file
   - Save it to your local machine

2. **Import the Solution**
   
   **Option A: Using Power Platform Admin Center**
   - Navigate to [https://make.powerapps.com](https://make.powerapps.com)
   - Select your target environment
   - Go to **Solutions** in the left navigation
   - Click **Import solution** at the top
   - Click **Browse** and select the downloaded `CustomMatrixPCF_managed.zip` file
   - Click **Next**, then **Import**
   - Wait for the import to complete (usually 1-2 minutes)

   **Option B: Using Power Platform CLI**
   ```powershell
   pac solution import --path CustomMatrixPCF_managed.zip
   ```

3. **Verify Installation**
   - After import completes, check for success message
   - Navigate to **Solutions** and confirm "Custom Matrix PCF" appears in the list
   - The control is now ready to use in your apps

> **Note**: The managed solution can be safely installed alongside other solutions and will not affect existing customizations.

## Configuration

### Adding to a Subgrid

1. Open your model-driven app in the form designer
2. Select the subgrid control you want to convert
3. Click "Add component" or replace the existing control
4. Select "Custom Matrix PCF" from the list
5. Configure the required properties (see below)

### Required Properties

| Property | Type | Description | Example |
|----------|------|-------------|---------|
| **Row Field** | Text | Logical name of the field to use for row headers | `statuscode` |
| **Column Field** | Text | Logical name of the field to use for column headers | `new_fiscalyear` |
| **Value Field** | Text | Logical name of the field to aggregate in cells | `estimatedvalue` |
| **Aggregation Type** | Enum | Type of aggregation to perform | Sum, Count, Average, Min, Max |

### Optional Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| **Show Totals** | Yes/No | Yes | Display total row and column with grand total |
| **Show Title** | Yes/No | Yes | Display auto-generated title with accent bar |

### Property Configuration Examples

**Example 1: Revenue by Status and Year**
- Row Field: `statuscode`
- Column Field: `new_estimatedcloseyear`
- Value Field: `estimatedvalue`
- Aggregation Type: `Sum`

**Example 2: Case Volume by Priority**
- Row Field: `prioritycode`
- Column Field: `statuscode`
- Value Field: `createdon`
- Aggregation Type: `Count`

**Example 3: Average Deal Size**
- Row Field: `new_salesregion`
- Column Field: `new_productype`
- Value Field: `estimatedvalue`
- Aggregation Type: `Average`

**Example 4: Opportunities by Owner and Account**
- Row Field: `ownerid` (Lookup)
- Column Field: `customerid` (Lookup)
- Value Field: `estimatedvalue`
- Aggregation Type: `Sum`

## Field Type Support

### Supported for Row/Column Headers

- ✅ **Text Fields**: Single Line of Text, Multiple Lines of Text
- ✅ **Option Sets**: Single-select option sets
- ✅ **Two Options**: Yes/No fields
- ✅ **Whole Numbers**: Integer fields
- ✅ **Date/Time**: Date fields (formatted as dates)
- ✅ **Lookup Fields**: All lookup types (Simple, Customer, Owner, PartyList, Regarding) - displays linked record name

### Supported for Value Fields (Aggregation)

| Aggregation | Supported Field Types |
|-------------|----------------------|
| **Count** | All field types (counts records regardless of value) |
| **Sum** | Whole Number, Decimal, Currency, Floating Point |
| **Average** | Whole Number, Decimal, Currency, Floating Point |
| **Minimum** | Whole Number, Decimal, Currency, Floating Point, Date/Time |
| **Maximum** | Whole Number, Decimal, Currency, Floating Point, Date/Time |

## Automatic Title Generation

When "Show Title" is enabled, the control automatically generates a descriptive title in the format:

```
{Entity Name}: {Aggregation} of {Value Field} by {Row Field} and {Column Field}
```

### Examples

- "Opportunities: Sum of Est. Revenue by Status and Estimated Close Year"
- "Cases: Count of Created On by Priority and Status"
- "Contacts: Minimum of Created on Date by Job Title and Preferred Method of Contact"

The title includes a blue accent bar below it for visual emphasis.

## Data Formatting

The control intelligently formats values based on the source field's data type:

- **Currency**: Formatted with currency symbol and 2 decimal places (e.g., $1,234.56)
- **Decimal/Floating Point**: Formatted with 2 decimal places (e.g., 123.45)
- **Whole Numbers**: No decimal places (e.g., 1,234)
- **Dates**: Formatted using locale-specific date format
- **Count Aggregations**: Always displayed as whole numbers

### Special Formatting Rules

- **Average of Whole Numbers**: Displayed as decimals (e.g., 23.45)
- **Average of Decimals**: Maintains 2 decimal places
- **Minimum/Maximum of Dates**: Displayed as formatted dates
- **Blank Values**: Displayed as "-" in cells with no data

## Limitations & Considerations

### Field Limitations

1. **Lookup Field Display**
   - Lookup fields show the display name (primary name field) of the linked record
   - Groups by the text value, so different records with the same name are grouped together
   - If a lookup field references deleted records, they may show as "(Blank)"

2. **Data Type Restrictions**
   - Sum and Average require numeric or currency fields
   - Min and Max require numeric, currency, or date fields
   - The control validates field types and displays helpful error messages

### Performance Considerations

1. **Record Count**
   - Best performance with subgrids containing up to 5,000 records
   - Larger datasets may experience slower rendering
   - Consider applying view filters to limit data

2. **Matrix Size**
   - Optimal display with 10-20 unique values per dimension
   - Very large matrices (e.g., 100x100) may require horizontal scrolling

3. **Aggregation Operations**
   - All calculations are performed client-side in the browser
   - Complex aggregations on large datasets may have processing delay

### Data Accuracy

1. **Null Value Handling**
   - Count aggregations include records even if the value field is null
   - Sum, Average, Min, Max exclude null values from calculations
   - Cells with no matching records display "-"

2. **Blank vs. Zero**
   - Zero values are included in all calculations
   - "(Blank)" label appears for null row/column grouping values

3. **Date Aggregations**
   - Min/Max on dates works by converting to timestamps internally
   - All dates displayed using browser's locale settings

### View and Filter Dependencies

1. **View Configuration**
   - The control respects the subgrid's underlying view
   - All required fields (row, column, value) must be in the view's columns
   - View filters are applied before the matrix is generated

2. **Permissions**
   - Users only see data they have read permissions for
   - Matrix reflects security roles and record ownership rules

## Styling & Appearance

The control uses Fluent UI components and follows Microsoft's design system:

- **Header Row/Column**: Light gray background (#f3f2f1) with medium weight font
- **Data Cells**: White background with standard weight font
- **Total Row/Column**: White background with bold font
- **Title**: 18px, semi-bold with 3px blue accent bar (#0078d4)
- **Borders**: Subtle borders (#edebe9) between all cells
- **Responsive**: Automatically adjusts column width based on available space

## Troubleshooting

### Common Issues

**Error: "Aggregation type 'Sum' requires a numeric or currency field"**
- Solution: Select a compatible aggregation type or change the value field

**Matrix shows "No records to display"**
- Check that the subgrid view has records
- Verify the view includes all required fields
- Check user permissions on the records

**Title shows wrong entity name**
- The control uses the entity's logical name, capitalized
- This is derived from the dataset's target entity type

**Columns are too narrow or too wide**
- Column width auto-adjusts based on number of columns
- For many columns, horizontal scrolling is enabled
- Columns are resizable by dragging the header borders

**Control not appearing in component list**
- Verify the solution imported successfully without errors
- Check that the app has been published after adding the control
- Ensure you're looking in the correct environment

## Unmanaged Solution (For Developers)

If you need to customize the control or prefer an unmanaged solution for development purposes:

1. Download `CustomMatrixPCF_unmanaged.zip` from the [Releases](../../releases) page
2. Import using the same steps as the managed solution
3. You can now modify the control's properties and republish

> **Warning**: Unmanaged solutions should only be used in development/test environments. Always use managed solutions in production.

## Development & Contributing

### Building from Source

For developers who want to contribute or customize the control:

```powershell
# Clone the repository
git clone https://github.com/gole1296/Custom-Matrix-PCF.git
cd Custom-Matrix-PCF

# Install dependencies
npm install

# Build the control
npm run build

# Test locally
npm start watch
```

### Running Tests

```powershell
# Push to test environment
pac pcf push --publisher-prefix [your-prefix]
```

### Creating a Solution Package

```powershell
# Create managed solution
msbuild /p:configuration=Release

# Solution will be in bin/Release folder
```

## Version History

### Version 0.1.0 (Current)
- Initial release
- Multi-dimensional pivot table functionality
- Support for 5 aggregation types (Count, Sum, Average, Min, Max)
- Support for all field types including lookup fields for row/column headers
- Auto-calculated row and column totals
- Smart data type formatting (currency, decimals, dates, etc.)
- Dynamic title generation with accent bar
- Configurable title and totals display options
- Fluent UI integration with responsive design

## Support & Feedback

- **Issues**: Report bugs or request features on [GitHub Issues](https://github.com/gole1296/Custom-Matrix-PCF/issues)
- **Discussions**: Ask questions or share ideas on [GitHub Discussions](https://github.com/gole1296/Custom-Matrix-PCF/discussions)
- **Documentation**: Full documentation available in this README

## License

MIT License - Feel free to use and modify for your organization's needs.

## Credits

Developed by EightyThirtyFive Solutions  
Built with Power Apps Component Framework and Fluent UI React

---

**Note**: This control is designed for model-driven Power Apps and requires the Power Apps Component Framework to be enabled in your environment.
